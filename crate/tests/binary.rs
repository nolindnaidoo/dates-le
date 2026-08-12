//! What happens to a file that is not text, now that the walk reads
//! every file rather than a shortlist of nine extensions.
//!
//! The distinction this pins is the one that keeps `--strict` usable: a
//! PNG was never a text candidate and produces no report line, while a
//! file that genuinely is text and cannot be read produces one saying
//! why and still fails a strict run. Before the walk widened, the first
//! kind was never opened; a repository with fourteen images in it would
//! otherwise report fourteen skips and exit 2 under `--strict`.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

/// A tree under the target directory, so nothing is left in `/tmp` and
/// two runs of the suite cannot collide.
struct Tree(PathBuf);

impl Tree {
    fn new(name: &str) -> Self {
        let path = Path::new(env!("CARGO_TARGET_TMPDIR")).join(name);
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).expect("the tree is created");
        Self(path)
    }

    fn write(&self, name: &str, bytes: &[u8]) -> &Self {
        let mut file = std::fs::File::create(self.0.join(name)).expect("the file is created");
        file.write_all(bytes).expect("the file is written");
        self
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

struct Run {
    stdout: String,
    stderr: String,
    code: Option<i32>,
}

/// `--no-ignore` on every run: the tree lives under `target/`, so the
/// repository's own `.gitignore` — which excludes `*.log` — would
/// otherwise decide half of what these tests assert.
fn run(tree: &Tree, arguments: &[&str]) -> Run {
    let output = Command::new(env!("CARGO_BIN_EXE_dates-le"))
        .arg(tree.0.as_os_str())
        .arg("--no-ignore")
        .args(arguments)
        .output()
        .expect("the binary runs");
    Run {
        stdout: String::from_utf8(output.stdout).expect("stdout is UTF-8"),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        code: output.status.code(),
    }
}

/// A PNG header, whose eighth byte is the NUL that says binary.
const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x01\0\0\0\x01\0";

#[test]
fn a_binary_file_is_absent_from_the_report_and_counted_in_the_summary() {
    let tree = Tree::new("binary-and-text");
    tree.write("notes.md", b"shipped 2024-01-15\n")
        .write("logo.png", PNG)
        .write("icon.ico", PNG);

    let run = run(&tree, &[]);

    assert_eq!(run.stdout.lines().count(), 1, "{}", run.stdout);
    assert!(run.stdout.contains("notes.md"), "{}", run.stdout);
    assert!(!run.stdout.contains(".png"), "{}", run.stdout);
    assert!(!run.stdout.contains(".ico"), "{}", run.stdout);
    assert!(
        run.stderr.contains("2 binary files skipped"),
        "the summary must still say the walk covered less than the tree: {}",
        run.stderr
    );
    assert_eq!(run.code, Some(0), "a date was found");
}

/// The reason the two are told apart at all.
#[test]
fn strict_ignores_a_binary_file() {
    let tree = Tree::new("binary-under-strict");
    tree.write("notes.md", b"shipped 2024-01-15\n")
        .write("logo.png", PNG);

    assert_eq!(run(&tree, &["--strict"]).code, Some(0));
}

/// Not UTF-8, and no NUL byte either: this is a text file that could not
/// be read, which is a genuinely incomplete answer and says so.
#[test]
fn a_text_file_that_cannot_be_read_is_named_and_fails_a_strict_run() {
    let tree = Tree::new("undecodable-text");
    tree.write("notes.md", b"shipped 2024-01-15\n")
        .write("latin.log", b"caf\xe9 2024-01-15\n");

    let plain = run(&tree, &[]);
    assert_eq!(plain.stdout.lines().count(), 2, "{}", plain.stdout);
    assert!(plain.stdout.contains("not UTF-8 text"), "{}", plain.stdout);
    assert!(plain.stderr.contains("1 skipped"), "{}", plain.stderr);
    assert!(
        !plain.stderr.contains("binary"),
        "undecodable text is not binary: {}",
        plain.stderr
    );
    assert_eq!(
        plain.code,
        Some(0),
        "a skipped file does not fail a plain run"
    );

    assert_eq!(run(&tree, &["--strict"]).code, Some(2));
}

/// The widened walk's own claim, checked end to end: a tree of file
/// types the old format filter dropped is read.
#[test]
fn every_text_file_in_the_tree_is_read() {
    let tree = Tree::new("many-file-types");
    tree.write("settings.py", b"CUTOVER = \"2024-01-15\"\n")
        .write("handler.go", b"const released = \"2024-01-15\"\n")
        .write("Cargo.toml", b"cut = 2024-01-15\n")
        .write("README.md", b"Released 2024-01-15.\n")
        .write("Makefile", b"# updated 2024-01-15\n");

    let run = run(&tree, &[]);
    assert_eq!(run.stdout.lines().count(), 5, "{}", run.stdout);
    assert!(
        run.stderr.starts_with("5 dates in 5 files"),
        "{}",
        run.stderr
    );
}
