//! The patterns, and the rule for what to do when two of them overlap.
//!
//! There is no parsing here and none anywhere else in this crate: every
//! format is this same scan over raw text, and the format only decides
//! which extra patterns join the six shared ones. That is why a
//! malformed JSON file still yields its dates instead of a parse error,
//! and why `.json` and `.csv` are read identically.
//!
//! Two things about the patterns are ported deliberately rather than
//! transcribed.
//!
//! JavaScript's `\d` is `[0-9]` and Rust's is every decimal digit in
//! Unicode, so `\d` is written out as `[0-9]` throughout. Left alone it
//! would read `٢٠٢٤-٠١-١٥` as a date the extension cannot see.
//! `\b` has the same split — ASCII there, Unicode here — so it is
//! written `(?<![A-Za-z0-9_])`, or `datetime=` after an accented character would
//! match in one frontend and not the other.
//!
//! `\s` is left Unicode, which is the *closer* match: JavaScript's `\s`
//! includes the non-breaking space and Rust's Unicode `\s` does too,
//! where an ASCII-only one would not.

use fancy_regex::Regex;

use super::parse::date_parse;
use super::position::locate_all;

/// What a value was recognised as. These names reach the user as
/// `format` in every answer, so they are a public contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Notation {
    Iso,
    Rfc2822,
    Unix,
    Utc,
    Local,
    Simple,
    Custom,
}

impl Notation {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Iso => "iso",
            Self::Rfc2822 => "rfc2822",
            Self::Unix => "unix",
            Self::Utc => "utc",
            Self::Local => "local",
            Self::Simple => "simple",
            Self::Custom => "custom",
        }
    }
}

/// How a matched string becomes an instant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Resolver {
    /// Hand it to `Date.parse`.
    DateParse,
    /// A bare epoch, which needs a range check `Date.parse` would not do.
    Unix,
    /// A syslog line carries no year, so one is appended.
    Syslog,
    /// Apache's `15/Jan/2024:10:30:08 +0000` is not a shape `Date.parse`
    /// reads, so it is rewritten into one first.
    Apache,
}

pub(crate) struct Pattern {
    regex: Regex,
    notation: Notation,
    resolver: Resolver,
}

/// A date found in a document, before positions are attached.
#[derive(Debug, Clone)]
pub(crate) struct Found {
    pub(crate) value: String,
    pub(crate) notation: Notation,
    pub(crate) timestamp: i64,
    pub(crate) line: usize,
    pub(crate) column: usize,
}

#[derive(Debug, Clone)]
struct Candidate {
    value: String,
    notation: Notation,
    timestamp: i64,
    start: usize,
    end: usize,
    /// Which pattern found it, so that at identical ranges the earlier
    /// one wins and a base classification beats a `custom` wrapper.
    order: usize,
}

/// The six patterns every format is scanned with.
fn base_patterns() -> Vec<Pattern> {
    vec![
        Pattern {
            regex: build(
                r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{3})?(?:Z|[+-][0-9]{2}:[0-9]{2})?",
            ),
            notation: Notation::Iso,
            resolver: Resolver::DateParse,
        },
        Pattern {
            regex: build(
                r"[A-Za-z]{3},\s[0-9]{1,2}\s[A-Za-z]{3}\s[0-9]{4}\s[0-9]{2}:[0-9]{2}:[0-9]{2}\s[A-Za-z]{3,4}",
            ),
            notation: Notation::Rfc2822,
            resolver: Resolver::DateParse,
        },
        // Ten or thirteen digits with no digit either side. The
        // lookbehind is what keeps an epoch out of a sixteen-digit card
        // number; the range check in `unix_timestamp` is what keeps a
        // nine-digit id out of 1970.
        Pattern {
            regex: build(r"(?<![0-9])(?:[0-9]{13}|[0-9]{10})(?![0-9])"),
            notation: Notation::Unix,
            resolver: Resolver::Unix,
        },
        Pattern {
            regex: build(
                r"[A-Za-z]{3}\s[A-Za-z]{3}\s[0-9]{2}\s[0-9]{4}\s[0-9]{2}:[0-9]{2}:[0-9]{2}\sGMT[+-][0-9]{4}",
            ),
            notation: Notation::Utc,
            resolver: Resolver::DateParse,
        },
        Pattern {
            regex: build(
                r"(?<![0-9])[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}\s[0-9]{1,2}:[0-9]{2}:[0-9]{2}(?![0-9])",
            ),
            notation: Notation::Local,
            resolver: Resolver::DateParse,
        },
        Pattern {
            regex: build(r"(?<![0-9])[0-9]{4}-[0-9]{2}-[0-9]{2}(?![0-9])"),
            notation: Notation::Simple,
            resolver: Resolver::DateParse,
        },
    ]
}

/// Log timestamps, syslog and Apache, for `log` and `plaintext`.
fn log_patterns() -> Vec<Pattern> {
    vec![
        // The space-separated form parses to the same instant as the T
        // form, so it is classified `iso` rather than given a name of
        // its own.
        Pattern {
            regex: build(
                r"(?<![0-9])[0-9]{4}-[0-9]{2}-[0-9]{2}\s[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{3})?(?![0-9])",
            ),
            notation: Notation::Iso,
            resolver: Resolver::DateParse,
        },
        Pattern {
            regex: build(
                r"(?<![A-Za-z])[A-Za-z]{3}\s+[0-9]{1,2}\s[0-9]{2}:[0-9]{2}:[0-9]{2}(?![0-9])",
            ),
            notation: Notation::Custom,
            resolver: Resolver::Syslog,
        },
        // The value is the timestamp, without the brackets around it.
        Pattern {
            regex: build(
                r"\[([0-9]{2}/[A-Za-z]{3}/[0-9]{4}:[0-9]{2}:[0-9]{2}:[0-9]{2}\s[+-][0-9]{4})\]",
            ),
            notation: Notation::Custom,
            resolver: Resolver::Apache,
        },
    ]
}

/// Date-constructor arguments, for `javascript` and `typescript`.
///
/// These surface strings that *only* their context identifies as dates —
/// `new Date('March 5, 2024')`. When the argument is itself a
/// recognisable shape the base patterns match the same range and win, so
/// `moment('2024-01-15')` is reported as `simple`, not `custom`.
fn javascript_patterns() -> Vec<Pattern> {
    [
        "new\\s+Date",
        "Date\\.parse",
        "moment",
        "dayjs",
        "DateTime\\.fromISO",
    ]
    .into_iter()
    .map(|callee| Pattern {
        regex: build(&format!(
            r#"(?<![A-Za-z0-9_]){callee}\s*\(\s*(['"`])([^'"`\n]+)\1\s*,?\s*\)"#
        )),
        notation: Notation::Custom,
        resolver: Resolver::DateParse,
    })
    .collect()
}

/// `datetime=` attributes, date-bearing `<meta>` tags and JSON-LD.
fn html_patterns() -> Vec<Pattern> {
    vec![
        Pattern {
            regex: build(r#"(?i)(?<![A-Za-z0-9_])datetime\s*=\s*(['"`])([^'"`]+)\1"#),
            notation: Notation::Custom,
            resolver: Resolver::DateParse,
        },
        Pattern {
            regex: build(
                r#"(?i)<meta[^>]*(?:property|name)\s*=\s*(['"`])(?:date|published|modified|created)\1[^>]*content\s*=\s*(['"`])([^'"`]+)\2"#,
            ),
            notation: Notation::Custom,
            resolver: Resolver::DateParse,
        },
        Pattern {
            regex: build(r#"(?i)"date(?:Published|Modified)"\s*:\s*(['"`])([^'"`]+)\1"#),
            notation: Notation::Custom,
            resolver: Resolver::DateParse,
        },
    ]
}

fn build(pattern: &str) -> Regex {
    Regex::new(pattern).expect("every pattern in this file is a literal and is tested")
}

/// Which extra patterns a language id brings, on top of the six.
pub(crate) fn patterns_for(language: &str) -> Vec<Pattern> {
    let mut patterns = base_patterns();
    match language {
        "log" | "plaintext" => patterns.extend(log_patterns()),
        "javascript" | "typescript" => patterns.extend(javascript_patterns()),
        "html" => patterns.extend(html_patterns()),
        _ => {}
    }
    patterns
}

/// Run every pattern over the whole document and return what survives.
///
/// Whole-content matching, not per line, so a `new Date(` split across
/// lines is still found.
///
/// `haystack` is what the patterns run over and `original` is what
/// positions are reported against. They are the same string everywhere
/// except XML, where comments are masked out — and there they must
/// differ, because masking can only preserve one of the two lengths
/// that matter. It preserves **bytes**, so a byte offset means the same
/// thing in both and nothing can slice mid-character; it does not
/// preserve UTF-16 units, because a two-byte `é` becomes two spaces.
/// Locating against the original is what keeps the column honest.
pub(crate) fn scan(haystack: &str, original: &str, patterns: &[Pattern], year: i64) -> Vec<Found> {
    debug_assert_eq!(
        haystack.len(),
        original.len(),
        "the haystack and the document it is located against must agree byte for byte"
    );
    let content = haystack;
    let mut candidates = Vec::new();

    for (order, pattern) in patterns.iter().enumerate() {
        let mut from = 0;
        while let Ok(Some(captures)) = pattern.regex.captures_from_pos(content, from) {
            // The date is the last capture group, or the whole match
            // when the pattern has none.
            let group = captures.len() - 1;
            let Some(matched) = captures.get(group) else {
                break;
            };
            let whole = captures.get(0).expect("group 0 always participates");
            // Advance past this match, and never stand still: a pattern
            // that can match empty would otherwise spin here.
            from = whole.end().max(whole.start() + 1);

            let value = matched.as_str();
            let Some(timestamp) = resolve(value, pattern.resolver, year) else {
                continue;
            };
            candidates.push(Candidate {
                value: value.to_string(),
                notation: pattern.notation,
                timestamp,
                start: matched.start(),
                end: matched.end(),
                order,
            });
        }
    }

    attach_positions(original, dedupe_contained(candidates))
}

fn resolve(value: &str, resolver: Resolver, year: i64) -> Option<i64> {
    match resolver {
        Resolver::DateParse => date_parse(value),
        Resolver::Unix => unix_timestamp(value),
        Resolver::Syslog => date_parse(&format!("{value} {year}")),
        Resolver::Apache => date_parse(&apache_shape(value)),
    }
}

/// A bare epoch, in seconds or milliseconds.
///
/// Ten digits alone is not enough — that is any account number — so the
/// value must also be past 1e9 seconds or 1e12 milliseconds, which puts
/// it after 2001. The upper end is whatever the digit count allows,
/// around 2286, and a ten-digit phone number does land inside it. That
/// is a false positive the shape cannot distinguish, and it is in the
/// corpus rather than hidden.
fn unix_timestamp(value: &str) -> Option<i64> {
    let number: i64 = value.parse().ok()?;
    match value.len() {
        10 if number > 1_000_000_000 => Some(number * 1000),
        13 if number > 1_000_000_000_000 => Some(number),
        _ => None,
    }
}

/// `15/Jan/2024:10:30:08 +0000` → `15 Jan 2024 10:30:08 +0000`.
///
/// Every slash becomes a space, then the *first* colon does — the ones
/// inside the time are left alone.
fn apache_shape(value: &str) -> String {
    let spaced = value.replace('/', " ");
    match spaced.find(':') {
        Some(index) => format!("{} {}", &spaced[..index], &spaced[index + 1..]),
        None => spaced,
    }
}

/// Drop any candidate whose range lies inside another's.
///
/// `2024-01-15T10:30:45Z` contains `2024-01-15`; both patterns match and
/// only the longer survives. The same text appearing *again* elsewhere
/// on the line is a separate range and is kept — which is the difference
/// between deduping ranges and deduping strings, and the reason a CSV
/// row with the same date in two columns reports two dates.
fn dedupe_contained(mut candidates: Vec<Candidate>) -> Vec<Candidate> {
    candidates.sort_by(|a, b| {
        a.start
            .cmp(&b.start)
            .then(b.end.cmp(&a.end))
            .then(a.order.cmp(&b.order))
    });

    let mut kept: Vec<Candidate> = Vec::new();
    let mut covering_end = 0usize;
    let mut started = false;
    for candidate in candidates {
        if started && candidate.end <= covering_end {
            continue;
        }
        covering_end = covering_end.max(candidate.end);
        started = true;
        kept.push(candidate);
    }
    kept
}

/// Candidates arrive sorted by start, which is what lets every position
/// be resolved in one pass over the document rather than one pass each.
fn attach_positions(content: &str, candidates: Vec<Candidate>) -> Vec<Found> {
    let offsets: Vec<usize> = candidates.iter().map(|candidate| candidate.start).collect();
    let located = locate_all(content, &offsets);
    candidates
        .into_iter()
        .zip(located)
        .map(|(candidate, (line, column))| Found {
            value: candidate.value,
            notation: candidate.notation,
            timestamp: candidate.timestamp,
            line,
            column,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn find(content: &str, language: &str) -> Vec<Found> {
        scan(content, content, &patterns_for(language), 2026)
    }

    fn values(content: &str, language: &str) -> Vec<String> {
        find(content, language)
            .into_iter()
            .map(|found| found.value)
            .collect()
    }

    #[test]
    fn each_of_the_six_shapes_is_classified() {
        for (text, expected) in [
            ("2024-01-15T10:30:45Z", Notation::Iso),
            ("Mon, 15 Jan 2024 10:30:45 GMT", Notation::Rfc2822),
            ("1705314645", Notation::Unix),
            ("Mon Jan 15 2024 10:30:45 GMT+0000", Notation::Utc),
            ("1/15/2024 10:30:45", Notation::Local),
            ("2024-01-15", Notation::Simple),
        ] {
            let found = find(text, "json");
            assert_eq!(found.len(), 1, "{text}");
            assert_eq!(found[0].notation, expected, "{text}");
        }
    }

    /// The longer match wins where they overlap, and an identical string
    /// elsewhere is a separate occurrence.
    #[test]
    fn a_date_inside_an_iso_one_is_dropped_but_a_repeat_is_not() {
        assert_eq!(
            values("2024-01-15T10:30:45Z", "json"),
            ["2024-01-15T10:30:45Z"]
        );
        assert_eq!(
            values("2024-01-15T10:30:45Z and 2024-01-15", "json"),
            ["2024-01-15T10:30:45Z", "2024-01-15"]
        );
        assert_eq!(
            values("2024-01-15 and 2024-01-15", "json"),
            ["2024-01-15", "2024-01-15"]
        );
    }

    /// The whole reason the epoch pattern has lookaround and a range
    /// check: neither alone is enough.
    #[test]
    fn a_digit_run_that_is_not_an_epoch_is_not_a_date() {
        assert!(
            values("4532015112830366", "json").is_empty(),
            "a card number"
        );
        assert!(values("999999999", "json").is_empty(), "nine digits");
        assert!(values("0000000001", "json").is_empty(), "below the floor");
    }

    /// A ten-digit phone number is inside the plausible range and cannot
    /// be told apart. Pinned so the limitation is visible rather than
    /// discovered.
    #[test]
    fn a_ten_digit_phone_number_is_a_false_positive() {
        assert_eq!(values("5551234567", "json"), ["5551234567"]);
    }

    #[test]
    fn only_javascript_reads_a_constructor_argument() {
        assert_eq!(
            values("new Date('March 5, 2024')", "typescript"),
            ["March 5, 2024"]
        );
        assert!(values("new Date('March 5, 2024')", "json").is_empty());
    }

    /// Whole-content matching, which is what a per-line scan could not do.
    #[test]
    fn a_constructor_split_across_lines_is_still_found() {
        assert_eq!(
            values("new Date(\n  'January 15 2024',\n)", "javascript"),
            ["January 15 2024"]
        );
    }

    #[test]
    fn an_argument_that_is_not_a_date_is_not_emitted() {
        assert!(values("new Date('sometime next week')", "typescript").is_empty());
    }

    /// The base classification wins at identical ranges, so a
    /// recognisable argument keeps its own name.
    #[test]
    fn a_recognisable_argument_keeps_its_base_classification() {
        let found = find("moment('2024-01-15')", "javascript");
        assert_eq!(found[0].notation, Notation::Simple);
    }

    #[test]
    fn html_reads_an_attribute_a_bare_scan_would_miss() {
        assert_eq!(
            values("<time datetime=\"March 5, 2024\">then</time>", "html"),
            ["March 5, 2024"]
        );
    }

    #[test]
    fn apache_loses_its_brackets_and_keeps_its_instant() {
        let found = find("[15/Jan/2024:10:30:08 +0000]", "log");
        assert_eq!(found[0].value, "15/Jan/2024:10:30:08 +0000");
        assert_eq!(found[0].timestamp, 1_705_314_608_000);
    }

    #[test]
    fn a_syslog_line_takes_the_year_it_is_given() {
        let found = scan(
            "Jan 15 10:30:47",
            "Jan 15 10:30:47",
            &patterns_for("log"),
            2026,
        );
        assert_eq!(found.len(), 1);
        let other = scan(
            "Jan 15 10:30:47",
            "Jan 15 10:30:47",
            &patterns_for("log"),
            2020,
        );
        assert_ne!(found[0].timestamp, other[0].timestamp);
    }

    #[test]
    fn log_patterns_belong_to_log_and_plaintext_only() {
        assert!(!values("Jan 15 10:30:47", "log").is_empty());
        assert!(!values("Jan 15 10:30:47", "plaintext").is_empty());
        assert!(values("Jan 15 10:30:47", "json").is_empty());
    }

    /// JavaScript's `\d` is ASCII and Rust's is not. Left alone this
    /// would find a date the extension cannot see.
    #[test]
    fn non_ascii_digits_are_not_digits() {
        assert!(values("٢٠٢٤-٠١-١٥", "json").is_empty());
    }

    #[test]
    fn the_epoch_pattern_reads_milliseconds_too() {
        let found = find("1705314645123", "json");
        assert_eq!(found[0].timestamp, 1_705_314_645_123);
    }
}
