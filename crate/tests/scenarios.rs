//! What only a document too big for the fast path can prove.
//!
//! Gated behind `DATES_LE_SCENARIOS=1` because these build documents in
//! the megabytes and are too slow to sit in the ordinary suite. CI runs
//! them on all three platforms.
//!
//! Every case here is a real failure that the unit tests passed
//! through. A log file with two hundred thousand timestamps on one line
//! took longer than anyone would wait, because resolving a column
//! counted UTF-16 units from the start of the line and there was only
//! one line. Ninety unit tests were green at the time.

use std::io::Write;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// The bounds below describe the **release** binary, which is what
/// anyone runs. `cargo test` builds unoptimized and CI runs these on a
/// shared Windows runner, where the same documents took 35–37s against a
/// 30s bound while release finishes in a fraction of it. Scaling keeps
/// the assertion meaningful in both builds rather than deleting it in
/// one: it exists to catch a scan that never finishes, not to measure a
/// runner.
#[cfg(debug_assertions)]
const BUDGET: Duration = Duration::from_secs(240);
#[cfg(not(debug_assertions))]
const BUDGET: Duration = Duration::from_secs(30);

fn enabled() -> bool {
    std::env::var("DATES_LE_SCENARIOS").as_deref() == Ok("1")
}

/// Run the packaged binary over a document on stdin, and say how long
/// it took.
fn run(document: &str, format: &str) -> (serde_json::Value, Duration) {
    let started = Instant::now();
    let mut child = Command::new(env!("CARGO_BIN_EXE_dates-le"))
        .env("TZ", "America/New_York")
        .args(["--stdin", "--format", format, "--year", "2026"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("the binary runs");
    child
        .stdin
        .as_mut()
        .expect("stdin is piped")
        .write_all(document.as_bytes())
        .expect("the document is written");
    let output = child.wait_with_output().expect("the binary finishes");
    let elapsed = started.elapsed();
    let text = String::from_utf8(output.stdout).expect("stdout is UTF-8");
    let line = text.lines().next().unwrap_or("{}");
    (
        serde_json::from_str(line).expect("stdout is one JSON object per line"),
        elapsed,
    )
}

fn count(report: &serde_json::Value) -> usize {
    report["dates"].as_array().map_or(0, Vec::len)
}

/// The regression. Two hundred thousand dates, all on one line, so
/// nothing about the work can be amortised across lines.
#[test]
fn a_single_line_with_two_hundred_thousand_dates_stays_linear() {
    if !enabled() {
        return;
    }
    let line = |count: usize| vec!["2024-01-15T10:30:45Z"; count].join(" ");
    let small = line(20_000);
    let large = line(200_000);

    let (small_report, small_time) = run(&small, "log");
    let (large_report, large_time) = run(&large, "log");
    assert_eq!(count(&small_report), 20_000);
    assert_eq!(count(&large_report), 200_000);

    // Ten times the input for well under a hundred times the work. The
    // quadratic version did not finish this at all.
    let ratio = large_time.as_secs_f64() / small_time.as_secs_f64().max(0.001);
    assert!(
        ratio < 40.0,
        "ten times the document took {ratio:.1}x the time, which is not linear \
         ({small_time:?} then {large_time:?})"
    );
}

/// An eight-megabyte run of digits, which the epoch pattern's lookahead
/// and lookbehind have to reject at every position.
#[test]
fn an_enormous_digit_run_is_not_a_date() {
    if !enabled() {
        return;
    }
    let document = format!("{{\"n\":{}}}", "9".repeat(8_000_000));
    let (report, elapsed) = run(&document, "json");
    assert_eq!(count(&report), 0, "a digit run is not an epoch");
    assert!(elapsed < BUDGET, "took {elapsed:?}");
}

/// The date-constructor patterns contain a negated character class that
/// a long unquoted run could make backtrack.
#[test]
fn a_long_unterminated_constructor_argument_does_not_backtrack() {
    if !enabled() {
        return;
    }
    let document = format!("new Date({})", "'".repeat(200_000));
    let (report, elapsed) = run(&document, "typescript");
    assert_eq!(count(&report), 0);
    assert!(elapsed < BUDGET, "took {elapsed:?}");
}

/// A half-megabyte attribute value, which the HTML patterns scan whole.
#[test]
fn an_enormous_attribute_value_is_read_once() {
    if !enabled() {
        return;
    }
    let document = format!("<a datetime=\"{}\">", "x".repeat(500_000));
    let (report, elapsed) = run(&document, "html");
    assert_eq!(count(&report), 0, "it is long, and it is not a date");
    assert!(elapsed < BUDGET, "took {elapsed:?}");
}

/// Many lines rather than one, so the position pass is exercised in the
/// other direction.
#[test]
fn a_hundred_thousand_lines_each_with_a_date() {
    if !enabled() {
        return;
    }
    let document = (0..100_000)
        .map(|index| format!("line {index} at 2024-01-15T10:30:45Z"))
        .collect::<Vec<_>>()
        .join("\n");
    let (report, elapsed) = run(&document, "log");
    assert_eq!(count(&report), 100_000);
    assert_eq!(report["dates"][99_999]["line"], 100_000);
    assert!(elapsed < BUDGET, "took {elapsed:?}");
}

/// Non-ASCII throughout, so every column is one the byte offset would
/// have got wrong — and, in an XML document, one the mask could have
/// slid.
#[test]
fn a_large_document_of_non_ascii_keeps_its_columns() {
    if !enabled() {
        return;
    }
    let document = (0..50_000)
        .map(|_| "<a><!-- café — naïve -->2024-01-15</a>".to_string())
        .collect::<Vec<_>>()
        .join("\n");
    let (report, elapsed) = run(&document, "xml");
    assert_eq!(count(&report), 50_000);
    for index in [0, 25_000, 49_999] {
        assert_eq!(
            report["dates"][index]["column"], 25,
            "column drifted at {index}"
        );
    }
    assert!(elapsed < BUDGET, "took {elapsed:?}");
}
