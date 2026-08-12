//! Does this crate open what it claims to open?
//!
//! The answer used to be no, and nothing measured it: the walk skipped
//! any file whose name resolved to none of nine formats, so a repository
//! of Python, Go, Rust, TOML and Markdown was walked and almost entirely
//! unread — and the report said "clean" rather than "unread". Nobody
//! knew until somebody counted by hand.
//!
//! Two questions, and they are different:
//!
//! - **Does the walk open every extension?** One file per name in the
//!   alias table, plus a dozen the table has never heard of, and a
//!   report line required for every one of them.
//! - **Does the corpus cover every advertised format?** A name in
//!   `SUPPORTED_FORMATS` with no document behind it is a format the two
//!   frontends have never been compared on.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const VALUE: &str = "2024-01-15";

/// Every name a caller can send, which is also every extension the tool
/// claims to recognise. Kept as a literal list rather than read from the
/// crate: this test exists to notice when the table changes, and a test
/// that reads the table it is checking cannot.
const ALIASES: [&str; 33] = [
    "json",
    "jsonc",
    "yaml",
    "yml",
    "csv",
    "tsv",
    "xml",
    "log",
    "txt",
    "text",
    "plaintext",
    "javascript",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "javascriptreact",
    "typescript",
    "ts",
    "tsx",
    "mts",
    "cts",
    "typescriptreact",
    "html",
    "htm",
    "xhtml",
    "toml",
    "ini",
    "cfg",
    "conf",
    "properties",
    "markdown",
    "md",
];

/// Extensions the table has never heard of. Every one of them is a real
/// file type somebody keeps dates in, and the widened walk's whole claim
/// is that they are read with the shared patterns rather than skipped.
const UNKNOWN: [&str; 14] = [
    "rs", "py", "go", "rb", "java", "kt", "swift", "c", "h", "sh", "sql", "php", "lua", "gradle",
];

/// The formats the tool schema advertises, and therefore the formats the
/// shared corpus has to have a document for.
const SUPPORTED_FORMATS: [&str; 11] = [
    "json",
    "yaml",
    "csv",
    "xml",
    "log",
    "plaintext",
    "javascript",
    "typescript",
    "html",
    "toml",
    "markdown",
];

fn sandbox() -> PathBuf {
    let path = Path::new(env!("CARGO_TARGET_TMPDIR")).join("coverage-matrix");
    let _ = std::fs::remove_dir_all(&path);
    std::fs::create_dir_all(&path).expect("the sandbox is created");
    path
}

#[test]
fn every_extension_the_table_names_is_opened_and_read() {
    let root = sandbox();
    let mut expected = Vec::new();
    for extension in ALIASES.into_iter().chain(UNKNOWN) {
        let name = format!("sample.{extension}");
        std::fs::write(root.join(&name), format!("released {VALUE}\n")).expect("a file is written");
        expected.push(name);
    }
    // A file with no extension at all, which is the shape a Makefile,
    // a Dockerfile and a LICENSE take.
    std::fs::write(root.join("Makefile"), format!("# cut {VALUE}\n")).expect("a file is written");
    expected.push("Makefile".to_string());

    let output = Command::new(env!("CARGO_BIN_EXE_dates-le"))
        .arg(root.as_os_str())
        .args(["--no-ignore", "--tz", "America/New_York"])
        .stdin(Stdio::null())
        .output()
        .expect("the binary runs");
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let _ = std::fs::remove_dir_all(&root);

    let reports: Vec<serde_json::Value> = stdout
        .lines()
        .map(|line| serde_json::from_str(line).expect("stdout is one JSON object per line"))
        .collect();

    let mut unread = Vec::new();
    for name in &expected {
        let found = reports.iter().find(|report| {
            report["file"]
                .as_str()
                .is_some_and(|file| file.ends_with(name.as_str()))
        });
        match found {
            None => unread.push(format!("{name}: no report line — the walk skipped it")),
            Some(report) if report["dates"][0]["value"] != VALUE => {
                unread.push(format!(
                    "{name}: opened and the date was not read: {report}"
                ));
            }
            Some(_) => {}
        }
    }
    assert!(
        unread.is_empty(),
        "{} of {} file types were not read:\n  {}",
        unread.len(),
        expected.len(),
        unread.join("\n  ")
    );
    assert_eq!(
        reports.len(),
        expected.len(),
        "the walk reported {} files for {} in the tree",
        reports.len(),
        expected.len()
    );
}

/// A format the schema offers and the corpus has never exercised is a
/// format the two frontends have never been compared on — the crate can
/// be wrong about it in exactly the way the corpus exists to prevent.
#[test]
fn every_advertised_format_has_a_corpus_document() {
    #[derive(serde::Deserialize)]
    struct Corpus {
        documents: Vec<Document>,
    }
    #[derive(serde::Deserialize)]
    struct Document {
        #[serde(rename = "fileType")]
        file_type: String,
    }

    let corpus: Corpus = serde_json::from_str(include_str!("../fixtures/extraction.json"))
        .expect("the corpus is valid JSON");
    let covered: Vec<&str> = corpus
        .documents
        .iter()
        .map(|document| document.file_type.as_str())
        .collect();

    let missing: Vec<&str> = SUPPORTED_FORMATS
        .into_iter()
        .filter(|format| !covered.contains(format))
        .collect();
    assert!(
        missing.is_empty(),
        "the tool schema offers {missing:?} and the shared corpus has no document for them, \
         so the two frontends have never been compared on that format"
    );
}

/// The advertised list and the alias table have to agree in one
/// direction: every advertised name must be a name the table resolves,
/// or the schema promises a format the resolver answers `unknown` for.
#[test]
fn every_advertised_format_is_a_name_the_table_knows() {
    for format in SUPPORTED_FORMATS {
        assert!(
            ALIASES.contains(&format),
            "{format} is advertised and is not in the alias table"
        );
    }
}
