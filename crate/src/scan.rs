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

/// Read a file and extract from it, or `None` if it is not text at all.
///
/// **A binary file is not a failure to read, and the difference is the
/// whole reason this returns an `Option`.** A PNG was never a candidate:
/// before the walk read every file it was never opened, and reporting
/// one as `skipped` would put fourteen images in the report of a website
/// repository and make `--strict` exit 2 on any tree containing one. A
/// file that genuinely *is* text and could not be read — no permission,
/// or bytes that are not UTF-8 — keeps its named `skipped` diagnostic
/// and keeps failing `--strict`, because that answer really is
/// incomplete. Binaries are counted in the summary instead, so the
/// reader still knows the walk covered less than the tree.
pub(crate) fn scan_file(path: &Path, options: &ScanOptions) -> Option<FileReport> {
    let label = reported_path(path);
    let name = path.file_name().and_then(|name| name.to_str());

    let language = resolve_format(options.format.as_deref(), name);
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) => return Some(FileReport::skipped(&label, error.to_string())),
    };
    if is_binary(&bytes) {
        return None;
    }
    let Ok(content) = String::from_utf8(bytes) else {
        return Some(FileReport::skipped(&label, "not UTF-8 text".to_string()));
    };
    Some(scan_text(&label, without_bom(&content), language, options))
}

/// A path as the report spells it, with `/` on every platform.
///
/// stdout is protocol — one JSON object per line, read by scripts, by
/// other tools and by whoever diffs two runs. The platform's own
/// spelling put `\` in every `file` value on Windows, so the same tree
/// produced two reports and a committed baseline broke the moment
/// somebody ran it there. A sibling in this family shipped that for a
/// release. stderr is a projection of the same reports, so it inherits
/// the same spelling.
pub(crate) fn reported_path(path: &Path) -> String {
    with_forward_slashes(&path.to_string_lossy(), std::path::MAIN_SEPARATOR)
}

/// The separator is a parameter, not a `cfg!`, for two reasons: it is
/// the actual discriminator, and it makes the Windows spelling testable
/// on every platform rather than only on the one that produces it —
/// which is how it shipped wrong in the first place.
///
/// A backslash is a legal character in a Unix filename, so the
/// substitution happens only where the backslash *is* the separator.
fn with_forward_slashes(path: &str, separator: char) -> String {
    if separator == '/' {
        return path.to_string();
    }
    path.replace(separator, "/")
}

/// ripgrep's heuristic: a NUL byte near the start means binary.
///
/// The same rule as the walker's, so "what this reads" stays the answer
/// a person already has in their head. Text does not contain NUL and
/// every common binary format has one in its header; eight kilobytes is
/// far enough in to find it and short enough to be free.
fn is_binary(bytes: &[u8]) -> bool {
    const SNIFFED_BYTES: usize = 8192;
    bytes.iter().take(SNIFFED_BYTES).any(|byte| *byte == b'\0')
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
/// real repository has something the runner lacks permission for or that
/// is not UTF-8; exiting 2 on those makes the tool unusable in CI, which
/// is the one place it is most worth running. They are reported on
/// stderr and in the JSON, and `--strict` is there for a pipeline that
/// genuinely wants them to fail the build. A file that is not text never
/// reaches here — `scan_file` returns nothing for it.
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

    /// A name that matches no format is read with the base patterns, so
    /// the only thing that can skip a file now is the file itself.
    #[test]
    fn a_name_that_matches_no_format_is_read_rather_than_skipped() {
        let report = scan_text("main.rs", "2024-01-15", "unknown", &options());
        assert!(report.skipped.is_none());
        assert_eq!(report.file_type, "unknown");
        assert_eq!(report.dates.len(), 1);
    }

    /// A file that could not be opened is a text file this run failed to
    /// cover, so it is named rather than dropped.
    #[test]
    fn an_unreadable_file_says_so() {
        let report = scan_file(Path::new("/nonexistent/a.json"), &options()).expect("a report");
        assert!(report.skipped.is_some());
        assert!(report.dates.is_empty());
    }

    /// The rule that keeps `--strict` usable: a PNG was never a text
    /// candidate, so it produces no report at all — where a file that is
    /// text and cannot be read produces one that says why.
    #[test]
    fn a_nul_byte_is_the_line_between_binary_and_unreadable() {
        assert!(is_binary(b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR"));
        assert!(!is_binary(b"2024-01-15\n"));
        assert!(!is_binary(b""));
        // Latin-1 text is not UTF-8 and not binary either: it is named,
        // not dropped.
        assert!(!is_binary(b"caf\xe9 2024-01-15"));
    }

    /// Only the head is sniffed, so a NUL far into a huge file does not
    /// make it binary — and the cost of the check does not scale with
    /// the file.
    #[test]
    fn only_the_head_of_a_file_is_sniffed() {
        let mut bytes = vec![b'a'; 9000];
        bytes.push(0);
        assert!(!is_binary(&bytes));
    }

    /// The report is protocol, so it has one spelling of a path rather
    /// than one per operating system. Both directions are checked here
    /// because only one of them is reachable on any given machine.
    #[test]
    fn a_reported_path_uses_forward_slashes_on_every_platform() {
        assert_eq!(
            with_forward_slashes(r"C:\repo\src\app.json", '\\'),
            "C:/repo/src/app.json"
        );
        assert_eq!(
            with_forward_slashes("/repo/src/app.json", '/'),
            "/repo/src/app.json"
        );
        // A backslash is a legal character in a Unix filename, and there
        // it is part of the name rather than a separator.
        assert_eq!(
            with_forward_slashes(r"/repo/od\d.json", '/'),
            r"/repo/od\d.json"
        );
        assert!(!reported_path(Path::new("a")).contains('\\'));
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
