//! Reading files and shaping the report.
//!
//! One report per file, and every field in it is either something the
//! extension also reports or something a flag explicitly asked for.

use std::path::Path;

use serde::Serialize;

use crate::extract::{self, Found, resolve_format, time};

#[derive(Debug, Clone)]
pub(crate) struct ScanOptions {
    /// Force a format instead of inferring it from the file name.
    pub(crate) format: Option<String>,
    pub(crate) dedupe: bool,
    pub(crate) sort: bool,
    pub(crate) iso: bool,
    /// Keep only instants at or after this one.
    pub(crate) after: Option<i64>,
    /// Keep only instants strictly before this one.
    pub(crate) before: Option<i64>,
    /// The year a syslog line is assumed to be in.
    pub(crate) year: i64,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            format: None,
            dedupe: false,
            sort: false,
            iso: false,
            after: None,
            before: None,
            year: time::current_year(),
        }
    }
}

#[derive(Debug, Serialize)]
pub(crate) struct Date {
    pub(crate) value: String,
    pub(crate) format: &'static str,
    pub(crate) timestamp: i64,
    pub(crate) line: usize,
    pub(crate) column: usize,
    /// The instant as a UTC ISO string, when `--iso` asked for it. A
    /// projection of `timestamp`, never a second source of truth.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) iso: Option<String>,
}

#[derive(Debug, Serialize)]
pub(crate) struct FileReport {
    pub(crate) file: String,
    #[serde(rename = "fileType")]
    pub(crate) file_type: String,
    pub(crate) dates: Vec<Date>,
    /// Why this file was not read, when it was not. A repository has
    /// images, archives and files the runner cannot open in it, and one
    /// of those is not a reason to fail — but it *is* a reason the
    /// answer is incomplete, so it is said out loud rather than
    /// swallowed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) skipped: Option<String>,
}

impl FileReport {
    fn skipped(file: &str, reason: String) -> Self {
        Self {
            file: file.to_string(),
            file_type: String::new(),
            dates: Vec::new(),
            skipped: Some(reason),
        }
    }
}

/// Extract from text already in hand.
pub(crate) fn scan_text(
    label: &str,
    content: &str,
    language: &str,
    options: &ScanOptions,
) -> FileReport {
    let found = extract::extract(content, language, options.year);
    FileReport {
        file: label.to_string(),
        file_type: language.to_string(),
        dates: shape(found, options),
        skipped: None,
    }
}

/// Read a file and extract from it.
pub(crate) fn scan_file(path: &Path, options: &ScanOptions) -> FileReport {
    let label = path.display().to_string();
    let name = path.file_name().and_then(|name| name.to_str());

    let Some(language) = resolve_format(options.format.as_deref(), name) else {
        return FileReport::skipped(&label, "no supported format for this file name".to_string());
    };
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) => return FileReport::skipped(&label, error.to_string()),
    };
    let Ok(content) = String::from_utf8(bytes) else {
        return FileReport::skipped(&label, "not UTF-8 text".to_string());
    };
    scan_text(&label, without_bom(&content), language, options)
}

/// Drop a leading byte-order mark.
///
/// No editor shows it and VS Code strips it before the extension ever
/// sees a document, so without this the two frontends read the same file
/// differently the moment anything on Windows saves it — Notepad, Excel,
/// a PowerShell redirect. Worse, they do it silently: three invisible
/// bytes before a `{` make a JSON parser reject the whole document,
/// which is indistinguishable from a file with nothing in it.
pub(crate) fn without_bom(content: &str) -> &str {
    content.strip_prefix('\u{feff}').unwrap_or(content)
}

/// Apply the flags that reshape a result, in the order that makes them
/// compose: filter, then dedupe, then sort.
///
/// Dedupe before sort so "the first occurrence" means the first in the
/// document, not the earliest instant — the same choice the extension
/// makes, and the one that keeps `--dedupe --sort` from depending on
/// which flag was typed first.
fn shape(found: Vec<Found>, options: &ScanOptions) -> Vec<Date> {
    let mut dates: Vec<Date> = found
        .into_iter()
        .filter(|date| options.after.is_none_or(|after| date.timestamp >= after))
        .filter(|date| options.before.is_none_or(|before| date.timestamp < before))
        .map(|date| Date {
            iso: options.iso.then(|| time::to_iso(date.timestamp)).flatten(),
            value: date.value,
            format: date.notation.as_str(),
            timestamp: date.timestamp,
            line: date.line,
            column: date.column,
        })
        .collect();

    if options.dedupe {
        let mut seen = std::collections::HashSet::new();
        dates.retain(|date| seen.insert(date.value.clone()));
    }
    if options.sort {
        dates.sort_by_key(|date| date.timestamp);
    }
    dates
}

/// grep's convention: found, not found, or a malformed question.
///
/// **A file that could not be read is not a malformed question.** Every
/// real repository has a PNG, a zip and something the runner lacks
/// permission for; exiting 2 on those makes the tool unusable in CI,
/// which is the one place it is most worth running. They are reported
/// on stderr and in the JSON, and `--strict` is there for a pipeline
/// that genuinely wants them to fail the build.
pub(crate) fn exit_code(reports: &[FileReport], strict: bool) -> std::process::ExitCode {
    if strict && reports.iter().any(|report| report.skipped.is_some()) {
        return std::process::ExitCode::from(2);
    }
    if reports.iter().any(|report| !report.dates.is_empty()) {
        return std::process::ExitCode::SUCCESS;
    }
    std::process::ExitCode::from(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> ScanOptions {
        ScanOptions {
            year: 2026,
            ..ScanOptions::default()
        }
    }

    const DOCUMENT: &str = "2024-03-01 then 2024-01-15 then 2024-01-15";

    fn values(options: &ScanOptions) -> Vec<String> {
        scan_text("x", DOCUMENT, "plaintext", options)
            .dates
            .into_iter()
            .map(|date| date.value)
            .collect()
    }

    #[test]
    fn dates_come_back_in_document_order() {
        assert_eq!(
            values(&options()),
            ["2024-03-01", "2024-01-15", "2024-01-15"]
        );
    }

    #[test]
    fn dedupe_keeps_the_first_occurrence() {
        let options = ScanOptions {
            dedupe: true,
            ..options()
        };
        assert_eq!(values(&options), ["2024-03-01", "2024-01-15"]);
    }

    #[test]
    fn sort_orders_by_instant() {
        let options = ScanOptions {
            sort: true,
            ..options()
        };
        assert_eq!(values(&options), ["2024-01-15", "2024-01-15", "2024-03-01"]);
    }

    /// Dedupe runs first, so "first occurrence" means first in the
    /// document however the flags were typed.
    #[test]
    fn dedupe_and_sort_compose_one_way_only() {
        let options = ScanOptions {
            dedupe: true,
            sort: true,
            ..options()
        };
        assert_eq!(values(&options), ["2024-01-15", "2024-03-01"]);
    }

    #[test]
    fn after_is_inclusive_and_before_is_not() {
        let boundary = 1_705_276_800_000; // 2024-01-15T00:00:00Z
        let after = ScanOptions {
            after: Some(boundary),
            ..options()
        };
        assert_eq!(values(&after).len(), 3);

        let before = ScanOptions {
            before: Some(boundary),
            ..options()
        };
        assert!(values(&before).is_empty());
    }

    #[test]
    fn iso_is_added_only_when_asked_for() {
        let plain = scan_text("x", "2024-01-15", "plaintext", &options());
        assert_eq!(plain.dates[0].iso, None);

        let options = ScanOptions {
            iso: true,
            ..options()
        };
        let annotated = scan_text("x", "2024-01-15", "plaintext", &options);
        assert_eq!(
            annotated.dates[0].iso.as_deref(),
            Some("2024-01-15T00:00:00Z")
        );
    }

    fn code(report: std::process::ExitCode) -> String {
        format!("{report:?}")
    }

    #[test]
    fn the_exit_code_follows_grep() {
        let found = scan_text("x", "2024-01-15", "plaintext", &options());
        let none = scan_text("x", "nothing", "plaintext", &options());

        assert_eq!(
            code(exit_code(&[found], false)),
            code(std::process::ExitCode::SUCCESS)
        );
        assert_eq!(
            code(exit_code(&[none], false)),
            code(std::process::ExitCode::from(1))
        );
    }

    /// The one that decides whether this is usable in CI. Every real
    /// repository contains something that is not text, and failing the
    /// build over it means the tool never gets run at all.
    #[test]
    fn a_skipped_file_does_not_fail_the_run() {
        let skipped = FileReport::skipped("logo.png", "not UTF-8 text".to_string());
        assert_eq!(
            code(exit_code(&[skipped], false)),
            code(std::process::ExitCode::from(1)),
            "a file that could not be read is not a malformed question"
        );
    }

    #[test]
    fn strict_turns_a_skipped_file_back_into_a_failure() {
        let skipped = FileReport::skipped("logo.png", "not UTF-8 text".to_string());
        assert_eq!(
            code(exit_code(&[skipped], true)),
            code(std::process::ExitCode::from(2))
        );
    }

    /// Found alongside a skip still reports found: the dates that were
    /// read are real whatever else was not.
    #[test]
    fn a_skip_does_not_hide_what_was_found() {
        let found = scan_text("x", "2024-01-15", "plaintext", &options());
        let skipped = FileReport::skipped("logo.png", "not UTF-8 text".to_string());
        assert_eq!(
            code(exit_code(&[found, skipped], false)),
            code(std::process::ExitCode::SUCCESS)
        );
    }

    #[test]
    fn a_file_with_no_supported_format_is_named_rather_than_dropped() {
        let report = scan_file(Path::new("/nonexistent/main.rs"), &options());
        assert!(report.skipped.is_some());
    }

    #[test]
    fn an_unreadable_file_says_so() {
        let report = scan_file(Path::new("/nonexistent/a.json"), &options());
        assert!(report.skipped.is_some());
        assert!(report.dates.is_empty());
    }

    /// Three invisible bytes that Notepad, Excel and a PowerShell
    /// redirect all add. Without stripping them the column on line one
    /// is wrong everywhere, and a JSON document is not read at all.
    #[test]
    fn a_byte_order_mark_is_not_part_of_the_document() {
        assert_eq!(without_bom("\u{feff}{\"a\":1}"), "{\"a\":1}");
        assert_eq!(without_bom("{\"a\":1}"), "{\"a\":1}");
        // Only a leading one: elsewhere it is a zero-width no-break
        // space and belongs to the text.
        assert_eq!(without_bom("a\u{feff}b"), "a\u{feff}b");
    }

    #[test]
    fn a_byte_order_mark_does_not_move_the_first_column() {
        let plain = scan_text("x", "2024-01-15", "plaintext", &options());
        let marked = scan_text(
            "x",
            without_bom("\u{feff}2024-01-15"),
            "plaintext",
            &options(),
        );
        assert_eq!(marked.dates.len(), plain.dates.len());
        assert_eq!(marked.dates[0].column, plain.dates[0].column);
    }
}
