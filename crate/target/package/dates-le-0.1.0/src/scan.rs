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
    /// Why a file could not be read. Present only when there is one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

impl FileReport {
    fn failed(file: &str, message: String) -> Self {
        Self {
            file: file.to_string(),
            file_type: String::new(),
            dates: Vec::new(),
            error: Some(message),
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
        error: None,
    }
}

/// Read a file and extract from it.
pub(crate) fn scan_file(path: &Path, options: &ScanOptions) -> FileReport {
    let label = path.display().to_string();
    let name = path.file_name().and_then(|name| name.to_str());

    let Some(language) = resolve_format(options.format.as_deref(), name) else {
        return FileReport::failed(&label, "no format for this file name".to_string());
    };
    match std::fs::read_to_string(path) {
        Ok(content) => scan_text(&label, &content, language, options),
        Err(error) => FileReport::failed(&label, error.to_string()),
    }
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
pub(crate) fn exit_code(reports: &[FileReport]) -> std::process::ExitCode {
    if reports.iter().any(|report| report.error.is_some()) {
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

    #[test]
    fn the_exit_code_follows_grep() {
        let found = scan_text("x", "2024-01-15", "plaintext", &options());
        let none = scan_text("x", "nothing", "plaintext", &options());
        let failed = FileReport::failed("x", "no".to_string());

        assert_eq!(
            format!("{:?}", exit_code(&[found])),
            format!("{:?}", std::process::ExitCode::SUCCESS)
        );
        assert_eq!(
            format!("{:?}", exit_code(&[none])),
            format!("{:?}", std::process::ExitCode::from(1))
        );
        assert_eq!(
            format!("{:?}", exit_code(&[failed])),
            format!("{:?}", std::process::ExitCode::from(2))
        );
    }

    #[test]
    fn a_file_with_no_format_is_reported_rather_than_skipped() {
        let report = scan_file(Path::new("/nonexistent/main.rs"), &options());
        assert!(report.error.is_some());
    }

    #[test]
    fn an_unreadable_file_says_so() {
        let report = scan_file(Path::new("/nonexistent/a.json"), &options());
        assert!(report.error.is_some());
        assert!(report.dates.is_empty());
    }
}
