//! The shared extraction corpus, run against this implementation.
//!
//! `scripts/check-extraction-parity.ts` runs the very same file against
//! the extension. Neither side owns the corpus; a disagreement fails a
//! build on whichever side moved.

use std::process::Command;

use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct Corpus {
    timezone: String,
    year: i64,
    documents: Vec<Document>,
}

#[derive(Debug, Deserialize)]
struct Document {
    name: String,
    file: String,
    #[serde(rename = "fileType")]
    file_type: String,
    expected: Vec<Value>,
}

const CORPUS: &str = include_str!("../fixtures/extraction.json");

/// The binary, run over one document from stdin.
fn run(document: &str, format: &str, year: i64, timezone: &str) -> Value {
    let mut command = Command::new(env!("CARGO_BIN_EXE_dates-le"));
    // The zone is named with `--tz` rather than set with `TZ`, because
    // Windows does not honour `TZ` and this test has to mean the same
    // thing on every platform the binary ships to.
    command
        .args([
            "--stdin",
            "--format",
            format,
            "--year",
            &year.to_string(),
            "--tz",
            timezone,
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped());

    let mut child = command.spawn().expect("the binary runs");
    {
        use std::io::Write;
        child
            .stdin
            .as_mut()
            .expect("stdin is piped")
            .write_all(document.as_bytes())
            .expect("the document is written");
    }
    let output = child.wait_with_output().expect("the binary finishes");
    let text = String::from_utf8(output.stdout).expect("stdout is UTF-8");
    let line = text.lines().next().unwrap_or("{}");
    serde_json::from_str(line).expect("stdout is one JSON object per line")
}

/// Every document, through the packaged binary rather than the library.
///
/// Through the binary on purpose: the library has been right while the
/// binary was wrong, in this family, more than once.
#[test]
fn every_corpus_document_extracts_identically() {
    let corpus: Corpus = serde_json::from_str(CORPUS).expect("the corpus is valid JSON");
    assert!(!corpus.documents.is_empty(), "the corpus has no documents");

    for document in &corpus.documents {
        let content = dates_le_corpus(&document.file);
        let report = run(&content, &document.file_type, corpus.year, &corpus.timezone);
        let actual = report["dates"].as_array().cloned().unwrap_or_default();

        assert_eq!(
            actual.len(),
            document.expected.len(),
            "{} ({}): found {} dates, the corpus says {}\n  found:    {}\n  expected: {}",
            document.name,
            document.file,
            actual.len(),
            document.expected.len(),
            serde_json::to_string(&actual).unwrap_or_default(),
            serde_json::to_string(&document.expected).unwrap_or_default(),
        );
        for (index, (found, expected)) in actual.iter().zip(&document.expected).enumerate() {
            assert_eq!(
                found, expected,
                "{} ({}), date {}",
                document.name, document.file, index
            );
        }
    }
}

/// The corpus documents, read from the tree next to this test.
fn dates_le_corpus(name: &str) -> String {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/documents")
        .join(name);
    std::fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("no corpus document at {}", path.display()))
}

/// The corpus is only a contract if it covers what ships. Every
/// document in the directory has to be used by a case.
#[test]
fn every_corpus_document_is_used() {
    let corpus: Corpus = serde_json::from_str(CORPUS).expect("the corpus is valid JSON");
    let used: Vec<&str> = corpus
        .documents
        .iter()
        .map(|document| document.file.as_str())
        .collect();

    let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/documents");
    for entry in std::fs::read_dir(directory).expect("the corpus directory exists") {
        let name = entry.expect("a readable entry").file_name();
        let name = name.to_string_lossy().to_string();
        assert!(
            used.contains(&name.as_str()),
            "{name} is in the corpus directory and no case uses it"
        );
    }
}
