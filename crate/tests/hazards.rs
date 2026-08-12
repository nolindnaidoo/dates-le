//! Inputs that break tools, run against the built binary.
//!
//! Not a fixture directory, and deliberately not: Windows cannot check
//! in a FIFO, a symlink loop or a file nobody may read, so the tree is
//! built at runtime and every case a platform cannot express is skipped
//! by name — either at compile time with `#[cfg]` and a comment, or at
//! run time with a line saying which case and why. A silent pass here
//! would be worse than no case at all.
//!
//! Every case asserts the same three things: the process does not panic,
//! does not hang, and leaves with 0, 1 or 2 rather than with a signal.
//! Everything below that is an assertion a crash-free run can still get
//! wrong — a byte-order mark moving a column, a PNG failing `--strict`,
//! an unreadable file exiting 2.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Far longer than any tree here needs, and far shorter than the
/// runner's own timeout. A hang has to fail this job by name, not by the
/// whole workflow being cancelled an hour later.
const DEADLINE: Duration = Duration::from_secs(60);

/// The value every content hazard carries, so "was it read" has one
/// answer to look for.
const VALUE: &str = "2024-01-15";

/// A PNG header, whose eighth byte is the NUL that says binary.
const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x01\0\0\0\x01\0";

/// A case the running platform cannot express. Named on stderr so a
/// green run still says what it did not check.
fn skipped(case: &str, why: &str) {
    eprintln!("hazards: skipped {case} — {why}");
}

/// A tree under the target directory, so nothing is left in the system
/// temp directory and two runs of the suite cannot collide.
struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path = Path::new(env!("CARGO_TARGET_TMPDIR"))
            .join("hazards")
            .join(name);
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).expect("the sandbox is created");
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn write(&self, name: &str, bytes: &[u8]) -> PathBuf {
        let path = self.0.join(name);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("the parent directory is created");
        }
        std::fs::write(&path, bytes).expect("the file is written");
        path
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        // The permission-denied case leaves a file its owner may not
        // read. Removing it needs write permission on the *directory*,
        // which is untouched, so this is enough on every platform.
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

struct Run {
    stdout: String,
    stderr: String,
    /// `None` only when the process left by a signal, which is itself
    /// the failure every case here is looking for.
    code: Option<i32>,
}

impl Run {
    fn report_for(&self, name: &str) -> Option<serde_json::Value> {
        self.stdout
            .lines()
            .map(|line| {
                serde_json::from_str::<serde_json::Value>(line)
                    .unwrap_or_else(|error| panic!("stdout line is not JSON ({error}): {line}"))
            })
            .find(|report| {
                report["file"]
                    .as_str()
                    .is_some_and(|file| file.ends_with(name))
            })
    }
}

/// `--no-ignore` on every run: the tree lives under `target/`, which the
/// repository's own ignore rules exclude, and a walk that saw nothing
/// would satisfy half the assertions below for the wrong reason.
fn run(root: &Path, arguments: &[&str]) -> Run {
    let mut child = Command::new(env!("CARGO_BIN_EXE_dates-le"))
        .arg(root.as_os_str())
        .arg("--no-ignore")
        .args(arguments)
        // Never inherited: a case must not be able to read the suite's
        // own stdin and block on it.
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the binary starts");

    // Drained on threads rather than after the wait. A hundred thousand
    // dates do not fit in a pipe buffer, and a child blocked on a full
    // pipe looks exactly like the hang this is here to detect.
    let mut out = child.stdout.take().expect("stdout is piped");
    let mut err = child.stderr.take().expect("stderr is piped");
    let stdout = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = out.read_to_end(&mut buffer);
        buffer
    });
    let stderr = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = err.read_to_end(&mut buffer);
        buffer
    });

    let started = Instant::now();
    let status = loop {
        match child.try_wait().expect("the child can be waited on") {
            Some(status) => break status,
            None if started.elapsed() > DEADLINE => {
                let _ = child.kill();
                let _ = child.wait();
                panic!(
                    "the binary did not finish within {DEADLINE:?} on {}",
                    root.display()
                );
            }
            None => std::thread::sleep(Duration::from_millis(10)),
        }
    };

    Run {
        stdout: String::from_utf8_lossy(&stdout.join().expect("stdout is drained")).into_owned(),
        stderr: String::from_utf8_lossy(&stderr.join().expect("stderr is drained")).into_owned(),
        code: status.code(),
    }
}

/// The three things every case asserts, whatever else it asserts.
fn survives(run: &Run, case: &str) {
    let Some(code) = run.code else {
        panic!("{case}: the binary left by a signal rather than with an exit code");
    };
    assert!(
        (0..=2).contains(&code),
        "{case}: exit {code} is not one of 0, 1 or 2\n{}",
        run.stderr
    );
    assert!(
        !run.stderr.contains("panicked at"),
        "{case}: the binary panicked\n{}",
        run.stderr
    );
}

/// What a case expects beyond surviving.
#[derive(Debug, Clone, Copy)]
enum Expected {
    /// A report line, with the value in it.
    Value,
    /// A report line, and no dates in it.
    NoDates,
    /// No report line at all — the file was never a text candidate.
    Binary,
    /// A report line carrying a `skipped` diagnostic.
    Skipped,
}

/// Every content hazard, each holding the same value so that "did it
/// read this" is one question with one answer.
fn content_hazards() -> Vec<(&'static str, &'static str, Vec<u8>, Expected)> {
    let hundred_thousand_lines = {
        use std::fmt::Write;
        let mut document = String::new();
        for index in 0..100_000 {
            let _ = writeln!(document, "line {index}");
        }
        document.push_str(VALUE);
        document
    };

    vec![
        (
            "utf-8 byte-order mark",
            "bom.json",
            [b"\xef\xbb\xbf".as_slice(), VALUE.as_bytes()].concat(),
            Expected::Value,
        ),
        (
            "crlf line endings",
            "crlf.json",
            format!("first\r\n{VALUE}\r\n").into_bytes(),
            Expected::Value,
        ),
        (
            "a lone carriage return",
            "lone-cr.json",
            format!("first\r{VALUE}").into_bytes(),
            Expected::Value,
        ),
        (
            "no trailing newline",
            "no-newline.json",
            VALUE.as_bytes().to_vec(),
            Expected::Value,
        ),
        ("an empty file", "empty.json", Vec::new(), Expected::NoDates),
        (
            "only whitespace",
            "whitespace.json",
            b"   \n\t\n \r\n".to_vec(),
            Expected::NoDates,
        ),
        (
            "a NUL byte mid-file",
            "nul.json",
            format!("{VALUE}\0after").into_bytes(),
            Expected::Binary,
        ),
        (
            "bytes that are not UTF-8",
            "latin.json",
            b"caf\xe9 2024-01-15\n".to_vec(),
            Expected::Skipped,
        ),
        (
            // Every second byte is NUL, so ripgrep's heuristic — and
            // therefore this crate's — calls it binary. Asserted rather
            // than hoped: the alternative is a report full of mojibake
            // and a `--strict` run that fails on a saved-from-Notepad
            // file.
            "utf-16le with a byte-order mark",
            "utf16.json",
            utf16le(VALUE),
            Expected::Binary,
        ),
        (
            "a four-byte emoji before the value",
            "emoji.json",
            format!("\u{1f4c5} {VALUE}").into_bytes(),
            Expected::Value,
        ),
        (
            "a line one megabyte long",
            "long-line.json",
            format!("{} {VALUE}", "x".repeat(1_000_000)).into_bytes(),
            Expected::Value,
        ),
        (
            "a hundred thousand lines",
            "many-lines.json",
            hundred_thousand_lines.into_bytes(),
            Expected::Value,
        ),
    ]
}

/// UTF-16LE with a byte-order mark, built by hand so that no dependency
/// decides what the bytes are.
fn utf16le(text: &str) -> Vec<u8> {
    let mut bytes = vec![0xff, 0xfe];
    for unit in text.encode_utf16() {
        bytes.extend_from_slice(&unit.to_le_bytes());
    }
    bytes
}

#[test]
fn every_content_hazard_is_survived_and_answered() {
    for (case, name, bytes, expected) in content_hazards() {
        let sandbox = Sandbox::new(&format!("content-{}", name.replace('.', "-")));
        sandbox.write(name, &bytes);

        let run = run(sandbox.path(), &[]);
        survives(&run, case);

        let report = run.report_for(name);
        match expected {
            Expected::Value => {
                let report = report.unwrap_or_else(|| panic!("{case}: no report line for {name}"));
                let dates = report["dates"].as_array().cloned().unwrap_or_default();
                assert!(
                    dates.iter().any(|date| date["value"] == VALUE),
                    "{case}: {VALUE} is in the document and not in the report: {report}"
                );
            }
            Expected::NoDates => {
                let report = report.unwrap_or_else(|| panic!("{case}: no report line for {name}"));
                assert_eq!(
                    report["dates"].as_array().map_or(0, Vec::len),
                    0,
                    "{case}: {report}"
                );
                assert!(report["skipped"].is_null(), "{case}: {report}");
            }
            Expected::Binary => assert!(
                report.is_none(),
                "{case}: a file that is not text was reported anyway: {report:?}"
            ),
            Expected::Skipped => {
                let report = report.unwrap_or_else(|| panic!("{case}: no report line for {name}"));
                assert!(
                    report["skipped"].is_string(),
                    "{case}: a text file that could not be read must say so: {report}"
                );
            }
        }
    }
}

/// The bug this class of check exists for: three invisible bytes that
/// Notepad, Excel and a PowerShell redirect all add, moving every column
/// on the first line.
#[test]
fn a_byte_order_mark_does_not_move_the_reported_column() {
    let sandbox = Sandbox::new("bom-column");
    let document = format!("{{\"at\":\"{VALUE}\"}}");
    sandbox.write("plain.json", document.as_bytes());
    sandbox.write(
        "marked.json",
        &[b"\xef\xbb\xbf".as_slice(), document.as_bytes()].concat(),
    );

    let run = run(sandbox.path(), &[]);
    survives(&run, "a byte-order mark and the same file without one");

    let column = |name: &str| -> serde_json::Value {
        run.report_for(name)
            .unwrap_or_else(|| panic!("no report line for {name}"))["dates"][0]["column"]
            .clone()
    };
    assert_eq!(
        column("marked.json"),
        column("plain.json"),
        "a byte-order mark moved the column: {}",
        run.stdout
    );
}

/// The rule that keeps `--strict` usable in CI: a repository with
/// fourteen images in it must not exit 2.
#[test]
fn a_binary_file_produces_no_report_line_and_does_not_fail_strict() {
    let sandbox = Sandbox::new("binary-and-strict");
    sandbox.write("notes.md", format!("shipped {VALUE}\n").as_bytes());
    sandbox.write("logo.png", PNG);

    let plain = run(sandbox.path(), &[]);
    survives(&plain, "a binary file");
    assert!(plain.report_for("logo.png").is_none(), "{}", plain.stdout);
    assert!(
        plain.stderr.contains("1 binary file skipped"),
        "the summary must still say the walk covered less than the tree: {}",
        plain.stderr
    );

    let strict = run(sandbox.path(), &["--strict"]);
    survives(&strict, "a binary file under --strict");
    assert_eq!(strict.code, Some(0), "{}", strict.stderr);
}

/// The other side of the same line: text that could not be decoded is an
/// incomplete answer, so it is named and it does fail a strict run.
#[test]
fn undecodable_text_is_named_and_fails_strict() {
    let sandbox = Sandbox::new("undecodable-and-strict");
    sandbox.write("notes.md", format!("shipped {VALUE}\n").as_bytes());
    sandbox.write("latin.log", b"caf\xe9 2024-01-15\n");

    let plain = run(sandbox.path(), &[]);
    survives(&plain, "undecodable text");
    assert_eq!(
        plain.code,
        Some(0),
        "a skipped file does not fail a plain run"
    );
    assert!(plain.stderr.contains("skipped"), "{}", plain.stderr);

    let strict = run(sandbox.path(), &["--strict"]);
    survives(&strict, "undecodable text under --strict");
    assert_eq!(strict.code, Some(2), "{}", strict.stderr);
}

/// Exit 2 means the question was malformed. It does not mean one file in
/// fifty thousand could not be opened.
#[test]
fn only_a_malformed_question_exits_two() {
    let sandbox = Sandbox::new("malformed-question");
    sandbox.write("notes.md", format!("shipped {VALUE}\n").as_bytes());

    for arguments in [
        ["--nope", "--iso"],
        ["--after", "soon"],
        ["--tz", "Mars/Olympus"],
    ] {
        let run = run(sandbox.path(), &arguments);
        survives(&run, &format!("a malformed question: {arguments:?}"));
        assert_eq!(run.code, Some(2), "{arguments:?}: {}", run.stderr);
    }

    // A path that does not exist is the question being malformed too.
    let missing = sandbox.path().join("nowhere");
    let run = run(&missing, &[]);
    survives(&run, "a path that does not exist");
    assert_eq!(run.code, Some(2), "{}", run.stderr);
}

/// Nothing on a filesystem is allowed to abort the walk, and nothing is
/// allowed to silently truncate it either — so the ordinary files in the
/// same tree are checked to still be read.
#[test]
fn every_filesystem_hazard_is_survived() {
    let sandbox = Sandbox::new("filesystem");
    sandbox.write("plain.json", VALUE.as_bytes());

    // A directory whose name looks like a document. The walk yields
    // directories and must not try to read one as a file.
    sandbox.write("looks-like.json/inside.json", VALUE.as_bytes());

    // Names a shell would need quoting for, and names outside ASCII.
    sandbox.write("with spaces.json", VALUE.as_bytes());
    sandbox.write("ünïcødé.json", VALUE.as_bytes());
    sandbox.write("calendar \u{1f4c5}.json", VALUE.as_bytes());

    symlinks(&sandbox);
    fifo(&sandbox);
    long_path(&sandbox);

    let run = run(sandbox.path(), &[]);
    survives(&run, "a tree of filesystem hazards");

    for name in [
        "plain.json",
        "inside.json",
        "with spaces.json",
        "ünïcødé.json",
        "calendar \u{1f4c5}.json",
    ] {
        let report = run
            .report_for(name)
            .unwrap_or_else(|| panic!("{name} was not read: {}", run.stdout));
        assert_eq!(report["dates"][0]["value"], VALUE, "{name}");
    }
}

/// A file nobody may read is not a malformed question: it is named,
/// carried in the report, and only `--strict` turns it into a failure.
///
/// Unix only, and not silently: Windows has no `chmod`, and an ACL that
/// denies the current user is not the same case.
#[cfg(unix)]
#[test]
fn a_file_that_cannot_be_opened_is_named_rather_than_fatal() {
    use std::os::unix::fs::PermissionsExt;

    let sandbox = Sandbox::new("permission-denied");
    sandbox.write("readable.json", VALUE.as_bytes());
    let secret = sandbox.write("secret.json", VALUE.as_bytes());
    std::fs::set_permissions(&secret, std::fs::Permissions::from_mode(0o000))
        .expect("permissions are set");

    // Root reads anything, so the case cannot be built there. Named
    // rather than asserted away.
    if std::fs::read(&secret).is_ok() {
        skipped("a permission-denied file", "this user can read it anyway");
        return;
    }

    let plain = run(sandbox.path(), &[]);
    survives(&plain, "a permission-denied file");
    assert_eq!(plain.code, Some(0), "an unreadable file is not exit 2");
    let report = plain.report_for("secret.json").unwrap_or_else(|| {
        panic!(
            "the unreadable file vanished from the report: {}",
            plain.stdout
        )
    });
    assert!(report["skipped"].is_string(), "{report}");

    let strict = run(sandbox.path(), &["--strict"]);
    survives(&strict, "a permission-denied file under --strict");
    assert_eq!(strict.code, Some(2));
}

/// A symlink to a file, one that points nowhere, and one that points at
/// its own parent.
///
/// Attempted rather than asserted on Windows: creating a symlink there
/// needs Developer Mode or an elevated process, and a runner without
/// either is a platform that cannot express the case rather than a
/// failure.
fn symlinks(sandbox: &Sandbox) {
    #[cfg(unix)]
    let link = |target: &Path, at: PathBuf| std::os::unix::fs::symlink(target, at);
    #[cfg(windows)]
    let link = |target: &Path, at: PathBuf| {
        if target.is_dir() {
            std::os::windows::fs::symlink_dir(target, at)
        } else {
            std::os::windows::fs::symlink_file(target, at)
        }
    };

    let target = sandbox.path().join("plain.json");
    if link(&target, sandbox.path().join("link-to-file.json")).is_err() {
        skipped("a symlink", "this platform will not create one");
        return;
    }
    let _ = link(
        Path::new("nowhere-at-all.json"),
        sandbox.path().join("broken-link.json"),
    );

    let loop_root = sandbox.path().join("loop");
    std::fs::create_dir_all(&loop_root).expect("the loop directory is created");
    let _ = link(&loop_root, loop_root.join("self"));
}

/// A named pipe, which would block a reader forever if the walk treated
/// it as an ordinary file.
///
/// Unix only, and through `mkfifo` rather than a libc call, because this
/// crate has no libc dependency and adding one for a test would be a
/// dependency in the shipped tarball.
#[cfg(unix)]
fn fifo(sandbox: &Sandbox) {
    let path = sandbox.path().join("pipe.json");
    let made = Command::new("mkfifo")
        .arg(path.as_os_str())
        .status()
        .is_ok_and(|status| status.success());
    if !made {
        skipped("a FIFO", "mkfifo is not available here");
    }
}

/// Windows has no filesystem FIFO to create, so the case does not exist
/// there rather than passing quietly.
#[cfg(windows)]
fn fifo(_sandbox: &Sandbox) {
    skipped("a FIFO", "Windows has no filesystem FIFO");
}

/// A path past the 260 characters Windows historically allowed. Built by
/// nesting rather than by one long name, because a single component is
/// capped at 255 on every platform here.
fn long_path(sandbox: &Sandbox) {
    let mut path = sandbox.path().to_path_buf();
    for _ in 0..5 {
        path = path.join("d".repeat(70));
    }
    if std::fs::create_dir_all(&path).is_err() {
        skipped(
            "a path over 260 characters",
            "this platform will not create one",
        );
        return;
    }
    if std::fs::write(path.join("deep.json"), VALUE.as_bytes()).is_err() {
        skipped(
            "a path over 260 characters",
            "the file could not be written",
        );
    }
}
