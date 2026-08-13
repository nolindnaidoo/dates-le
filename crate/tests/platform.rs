//! Behaviour that differs by operating system, asserted rather than
//! hoped.
//!
//! Everything here is a property that holds on the machine it was
//! written on and can quietly stop holding on one of the other two. The
//! report's path separator shipped wrong in this family for a release
//! because the only runner that produced `\` was the one nobody read the
//! JSON from.
//!
//! The suite's independence from `TZ` is checked by the workflow rather
//! than from here — it runs the whole suite under `TZ=UTC`, under
//! `TZ=Asia/Kolkata` and with `TZ` unset, and requires the three results
//! to be identical. What is checked *here* is the mechanism that makes
//! that possible: a named zone beats the environment, which is the only
//! way a corpus can mean the same thing on Windows, where `TZ` is
//! ignored.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const VALUE: &str = "2024-01-15";

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path = Path::new(env!("CARGO_TARGET_TMPDIR"))
            .join("platform")
            .join(name);
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).expect("the sandbox is created");
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn write(&self, name: &str, contents: &str) {
        let path = self.0.join(name);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("the parent directory is created");
        }
        std::fs::write(path, contents).expect("the file is written");
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

struct Run {
    stdout: String,
    stderr: String,
    code: Option<i32>,
}

impl Run {
    fn reports(&self) -> Vec<serde_json::Value> {
        self.stdout
            .lines()
            .map(|line| serde_json::from_str(line).expect("stdout is one JSON object per line"))
            .collect()
    }

    fn files(&self) -> Vec<String> {
        self.reports()
            .iter()
            .map(|report| report["file"].as_str().unwrap_or_default().to_string())
            .collect()
    }
}

/// `--no-ignore` for the same reason as everywhere else in this suite:
/// the tree lives under `target/`, which the repository's own ignore
/// rules exclude.
fn run(root: &Path, arguments: &[&str]) -> Run {
    let output = Command::new(env!("CARGO_BIN_EXE_dates-le"))
        .arg(root.as_os_str())
        .arg("--no-ignore")
        .args(arguments)
        .stdin(Stdio::null())
        .output()
        .expect("the binary runs");
    Run {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        code: output.status.code(),
    }
}

/// stdout is protocol. A `file` field spelled with `\` on one runner and
/// `/` on the other two is the same report that only one consumer can
/// read, which is what envsync-le shipped for a release.
#[test]
fn every_reported_path_uses_forward_slashes() {
    let sandbox = Sandbox::new("separators");
    sandbox.write("top.json", VALUE);
    sandbox.write("nested/deeper/inner.json", VALUE);
    // A file that is text and cannot be decoded, so stderr names a path
    // as well as counting one. stderr is a projection of the same
    // reports and has to spell them the same way.
    std::fs::write(
        sandbox.path().join("latin.log"),
        b"caf\xe9 2024-01-15\n".as_slice(),
    )
    .expect("the file is written");

    let run = run(sandbox.path(), &[]);
    assert_eq!(run.code, Some(0), "{}", run.stderr);
    assert_eq!(run.files().len(), 3, "{}", run.stdout);

    // The guard against a vacuous assertion: a nested path has to be in
    // the report at all, spelled with separators, before "no backslashes"
    // means anything. On Windows this is exactly the substitution under
    // test; elsewhere it is free.
    assert!(
        run.files()
            .iter()
            .any(|file| file.ends_with("nested/deeper/inner.json")),
        "no nested path was reported, so the separator assertion proves nothing: {}",
        run.stdout
    );
    for file in run.files() {
        assert!(
            !file.contains('\\'),
            "a report path used the platform separator: {file}"
        );
    }

    // The same for stderr, and the same guard: it has to be naming a
    // path before the absence of a backslash says anything.
    assert!(
        run.stderr.contains("latin.log"),
        "stderr named no path: {}",
        run.stderr
    );
    assert!(
        !run.stderr.contains('\\'),
        "stderr spelled a path the platform's way: {}",
        run.stderr
    );
}

/// `README.md` and `readme.md` are one file on macOS and Windows and two
/// on Linux. Either answer is right; reporting one file twice is not.
#[test]
fn the_walk_does_not_report_one_file_twice() {
    let sandbox = Sandbox::new("case-folding");
    sandbox.write("README.md", &format!("shipped {VALUE}\n"));
    sandbox.write("readme.md", &format!("shipped {VALUE}\n"));

    let on_disk = std::fs::read_dir(sandbox.path())
        .expect("the sandbox is readable")
        .count();
    assert!(
        (1..=2).contains(&on_disk),
        "the sandbox holds {on_disk} entries, which is neither answer"
    );

    let run = run(sandbox.path(), &[]);
    assert_eq!(run.code, Some(0), "{}", run.stderr);

    let mut files = run.files();
    files.sort();
    let distinct = {
        let mut unique = files.clone();
        unique.dedup();
        unique.len()
    };
    assert_eq!(
        distinct,
        files.len(),
        "a file was reported twice: {files:?}"
    );
    assert_eq!(
        files.len(),
        on_disk,
        "the walk reported {} files for {on_disk} on disk: {files:?}",
        files.len()
    );
}

/// `CON`, `PRN`, `AUX`, `NUL` and `COM1` are device names on Windows, so
/// creating them there fails. The walk has to survive the tree it
/// actually got — the test does not assert the files exist, it asserts
/// the ordinary file beside them is still read.
#[test]
fn a_reserved_windows_name_does_not_stop_the_walk() {
    let sandbox = Sandbox::new("reserved-names");
    sandbox.write("ordinary.json", VALUE);

    let mut created = Vec::new();
    for name in ["CON", "PRN", "AUX", "NUL", "COM1"] {
        let path = sandbox.path().join(name);
        let expected = format!("shipped {VALUE}\n");
        match std::fs::write(&path, &expected) {
            // Creating `NUL` on Windows reports success and writes to the
            // null device, so the name exists and holds nothing. A walk
            // cannot report a date in a file with no content, and should
            // not be asked to. The test therefore requires what it can
            // itself read back, not what the platform claimed to write.
            Ok(()) => match std::fs::read_to_string(&path) {
                Ok(back) if back == expected => created.push(name),
                _ => eprintln!(
                    "platform: {name} accepted a write and did not hold it — a device name, not a file"
                ),
            },
            // Named rather than swallowed: a green run should still say
            // which cases this platform could not build.
            Err(error) => eprintln!("platform: skipped the reserved name {name} — {error}"),
        }
    }

    let run = run(sandbox.path(), &[]);
    assert_eq!(run.code, Some(0), "{}", run.stderr);
    assert!(
        run.files()
            .iter()
            .any(|file| file.ends_with("ordinary.json")),
        "the walk stopped at a reserved name: {}",
        run.stdout
    );
    for name in created {
        assert!(
            run.files().iter().any(|file| file.ends_with(name)),
            "{name} was created and not read: {}",
            run.stdout
        );
    }
}

/// A child that refuses before it ever reads stdin closes the pipe under
/// the writer. The assertion is the exit code; the write is allowed to
/// fail, because whether it does is a race between two processes and
/// asserting on it cost this family a red CI once.
#[test]
fn stdin_closed_early_is_an_exit_code_and_never_a_broken_write() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_dates-le"))
        .args(["--nope", "--stdin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("the binary starts");

    {
        let mut stdin = child.stdin.take().expect("stdin is piped");
        // Far more than a pipe buffer holds, so the write cannot finish
        // before the child has gone. Its result is deliberately dropped.
        let document = format!("{VALUE}\n").repeat(200_000);
        let _ = stdin.write_all(document.as_bytes());
        let _ = stdin.flush();
    }

    let status = child.wait().expect("the binary finishes");
    assert_eq!(
        status.code(),
        Some(2),
        "a refused question is exit 2 however the write went"
    );
}

/// The mechanism the corpus rests on: `--tz` names a zone and the
/// environment does not get a say.
///
/// This is what makes the contract checkable on all three platforms.
/// Windows ignores `TZ` entirely, so a corpus that read the environment
/// could only ever have been verified on two of them.
#[test]
fn a_named_zone_beats_the_environment_variable() {
    let document = format!("{VALUE}T00:00:00\n");
    let answers: Vec<String> = [Some("UTC"), Some("Asia/Kolkata"), None]
        .into_iter()
        .map(|zone| {
            let mut command = Command::new(env!("CARGO_BIN_EXE_dates-le"));
            command.args(["--stdin", "--format", "log", "--tz", "America/New_York"]);
            match zone {
                Some(zone) => command.env("TZ", zone),
                // Removed rather than left inherited: "unset" is one of
                // the three states the workflow runs the suite in.
                None => command.env_remove("TZ"),
            };
            let mut child = command
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()
                .expect("the binary runs");
            // Taken and dropped rather than borrowed: the pipe has to
            // close, or the child waits for an end of input that never
            // arrives and the read below waits for the child.
            {
                let mut stdin = child.stdin.take().expect("stdin is piped");
                stdin
                    .write_all(document.as_bytes())
                    .expect("the document is written");
            }
            let mut stdout = String::new();
            child
                .stdout
                .as_mut()
                .expect("stdout is piped")
                .read_to_string(&mut stdout)
                .expect("stdout is read");
            child.wait().expect("the binary finishes");
            stdout
        })
        .collect();

    assert_eq!(answers[0], answers[1], "TZ changed a --tz answer");
    assert_eq!(answers[1], answers[2], "unsetting TZ changed a --tz answer");
    // A zone-less date-time really does resolve against a zone, so the
    // answer above is only meaningful if it is not the UTC one.
    assert!(
        answers[0].contains("1705294800000"),
        "2024-01-15T00:00:00 in New York is not what came back: {}",
        answers[0]
    );
}
