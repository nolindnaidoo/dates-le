//! The date shapes `Date.parse` refuses, and what this tool answers
//! instead.
//!
//! Everything here is a **deliberate divergence from V8**, and it lives
//! in its own file so that `parse.rs` never has to hold a rule V8 does
//! not have. ISO 8601 week dates, ordinal dates and the basic format are
//! all `NaN` in V8, as is every timezone abbreviation outside the eight
//! US ones — and all of them appear in real files, which is the whole
//! argument for reading them.
//!
//! **Nothing here computes an instant.** Each shape is normalised into a
//! string V8 *does* read and handed back to `date_parse`. That is what
//! keeps `2024-W03` UTC for the same reason `2024-01-15` is UTC, keeps a
//! zone-less basic date-time local with the machine's daylight-saving
//! history, and keeps the two frontends answering identically without
//! the calendar arithmetic being written out twice.

use super::parse::date_parse;

/// The timezone abbreviations V8 lacks, and the fixed offset each
/// stands for.
///
/// **Fixed, not zone-aware**, which is the same rule V8 applies to the
/// eight it does know: `EST` is −5 in July as much as in January. Local
/// time is a property of the machine reading the file, never of a name
/// inside it.
///
/// `IST` is three zones — India +05:30, Ireland +01:00, Israel +02:00 —
/// and no text can say which. India is the one taken, because it is the
/// common one in source and the only one of the three whose offset is
/// not already reachable by another abbreviation here. It is a guess,
/// which is why it is named as one in SPEC.md.
const NAMED_ZONES: [(&str, &str); 6] = [
    ("CEST", "+0200"),
    ("AEST", "+1000"),
    ("CET", "+0100"),
    ("BST", "+0100"),
    ("JST", "+0900"),
    ("IST", "+0530"),
];

/// Resolve with `Date.parse`, and only then with the zone names it
/// lacks.
///
/// The order is the contract: V8 answers everything it can answer, so
/// the oracle in `fixtures/date-parse.json` stays the authority and this
/// layer can only turn a refusal into a value, never a value into a
/// different one.
pub(crate) fn instant(value: &str) -> Option<i64> {
    if let Some(timestamp) = date_parse(value) {
        return Some(timestamp);
    }
    date_parse(&with_numeric_zone(value)?)
}

/// Rewrite the first known abbreviation into its numeric offset.
///
/// Matched as a whole word rather than as a substring: V8 matches a
/// keyword on its first three letters, and doing the same here would
/// read the `IST` in `HISTORY` as India.
fn with_numeric_zone(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut word_start = None;

    for index in 0..=bytes.len() {
        let is_letter = bytes.get(index).is_some_and(u8::is_ascii_alphabetic);
        match (word_start, is_letter) {
            (None, true) => word_start = Some(index),
            (Some(start), false) => {
                let word = &value[start..index];
                if let Some((_, offset)) = NAMED_ZONES
                    .iter()
                    .find(|(name, _)| word.eq_ignore_ascii_case(name))
                {
                    return Some(format!("{}{offset}{}", &value[..start], &value[index..]));
                }
                word_start = None;
            }
            _ => {}
        }
    }
    None
}

/// A run of exactly `width` ASCII digits, as a number.
///
/// **The width is the validation.** The extension's equivalents are
/// anchored regexes — `^(\d{4})-W(\d{2})(?:-(\d))?$` and friends — so
/// they cannot be handed a numeral of another shape at all. These
/// functions took whatever `parse` would swallow, which is a wider
/// contract than the extension's for no reason and, at a year of
/// nineteen digits, wide enough to overflow the weekday arithmetic. The
/// patterns that feed these cannot produce one; a caller reaching the
/// function directly can, and did.
fn digits(text: &str, width: usize) -> Option<i64> {
    if text.len() != width || !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

/// `2024-W03` or `2024-W03-1` → the calendar date it names.
///
/// ISO 8601 defines week 1 as the one containing 4 January, so the whole
/// calculation hangs off which weekday that is. A week can start in the
/// previous year and end in the next, and both directions happen:
/// `2015-W01-1` is 29 December 2014.
pub(crate) fn week_date(value: &str) -> Option<i64> {
    let (year_text, rest) = value.split_once("-W")?;
    let (week_text, day_text) = match rest.split_once('-') {
        Some((week, day)) => (week, Some(day)),
        None => (rest, None),
    };
    let year = digits(year_text, 4)?;
    let week = digits(week_text, 2)?;
    let day = match day_text {
        Some(text) => digits(text, 1)?,
        None => 1,
    };

    // A year has 52 weeks or 53, and asking for a 53rd it does not have
    // is a refusal rather than the first week of the next year — the
    // string named a week that does not exist.
    if !(1..=weeks_in_year(year)).contains(&week) || !(1..=7).contains(&day) {
        return None;
    }

    let first_monday = 5 - january_fourth_weekday(year);
    resolve_ordinal(year, first_monday + (week - 1) * 7 + (day - 1))
}

/// `2024-015` → the fifteenth day of 2024.
pub(crate) fn ordinal_date(value: &str) -> Option<i64> {
    let (year_text, ordinal_text) = value.split_once('-')?;
    let year = digits(year_text, 4)?;
    let ordinal = digits(ordinal_text, 3)?;
    let (month, day) = month_and_day(year, ordinal)?;
    date_parse(&format!("{year:04}-{month:02}-{day:02}"))
}

/// `20240115`, `20240115T103045Z` → the extended form of the same.
///
/// The bare eight-digit form is the one shape here that cannot prove it
/// is a date: `20240115` and an eight-digit identifier are the same
/// characters. It is therefore held to a plausible year as well as a
/// real month and day, the same way a ten-digit epoch is held to a
/// plausible range. The date-time form needs no such window — a `T`
/// between six digits and eight is evidence of its own.
pub(crate) fn basic_format(value: &str) -> Option<i64> {
    let year = digits(value.get(0..4)?, 4)?;
    let month = digits(value.get(4..6)?, 2)?;
    let day = digits(value.get(6..8)?, 2)?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }

    let date = format!("{year:04}-{month:02}-{day:02}");
    let rest = value.get(8..)?;
    if rest.is_empty() {
        // Wide enough for anything a codebase dates itself with, narrow
        // enough that most identifiers fall out: `12345678` is month 56
        // and never reaches here, but `98765432` would be a September in
        // the year 9876 without it.
        if !(1900..=2099).contains(&year) {
            return None;
        }
        return date_parse(&date);
    }

    let time = rest.strip_prefix('T')?;
    let hour = time.get(0..2)?;
    let minute = time.get(2..4)?;
    let second = time.get(4..6)?;
    let mut normalised = format!("{date}T{hour}:{minute}:{second}");

    let mut tail = time.get(6..)?;
    if let Some(fraction) = tail.strip_prefix('.') {
        let digits: String = fraction.chars().take_while(char::is_ascii_digit).collect();
        normalised.push('.');
        normalised.push_str(&digits);
        tail = tail.get(1 + digits.len()..)?;
    }
    normalised.push_str(&extended_zone(tail)?);

    date_parse(&normalised)
}

/// `Z`, `+0530`, `+05` or nothing → what the extended grammar wants.
fn extended_zone(tail: &str) -> Option<String> {
    if tail.is_empty() || tail == "Z" {
        return Some(tail.to_string());
    }
    let sign = tail.get(0..1).filter(|sign| *sign == "+" || *sign == "-")?;
    let hour = tail.get(1..3)?;
    let minute = match tail.len() {
        3 => "00",
        5 => tail.get(3..5)?,
        _ => return None,
    };
    Some(format!("{sign}{hour}:{minute}"))
}

/// A day of the year, allowed to fall either side of it, as an instant.
///
/// A week date reaches here with an ordinal outside its own year
/// whenever the week spans a year boundary, which is exactly what makes
/// week dates worth having a calculation for.
fn resolve_ordinal(mut year: i64, mut ordinal: i64) -> Option<i64> {
    if ordinal < 1 {
        year -= 1;
        ordinal += days_in_year(year);
    } else if ordinal > days_in_year(year) {
        ordinal -= days_in_year(year);
        year += 1;
    }
    let (month, day) = month_and_day(year, ordinal)?;
    date_parse(&format!("{year:04}-{month:02}-{day:02}"))
}

/// The month and day a day-of-year lands on, or `None` if the year has
/// no such day.
fn month_and_day(year: i64, ordinal: i64) -> Option<(i64, i64)> {
    if !(1..=days_in_year(year)).contains(&ordinal) {
        return None;
    }
    let february = if is_leap(year) { 29 } else { 28 };
    let lengths = [31, february, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    let mut remaining = ordinal;
    for (index, length) in lengths.into_iter().enumerate() {
        if remaining <= length {
            return Some((index as i64 + 1, remaining));
        }
        remaining -= length;
    }
    None
}

fn is_leap(year: i64) -> bool {
    year.rem_euclid(4) == 0 && (year.rem_euclid(100) != 0 || year.rem_euclid(400) == 0)
}

fn days_in_year(year: i64) -> i64 {
    if is_leap(year) { 366 } else { 365 }
}

/// The weekday of 31 December, Sunday 0 — the standard year-only
/// calculation, and the only piece of calendar arithmetic this file
/// needs that a rewrite cannot supply.
fn last_day_of_year(year: i64) -> i64 {
    (year + year.div_euclid(4) - year.div_euclid(100) + year.div_euclid(400)).rem_euclid(7)
}

/// The ISO weekday of 4 January, Monday 1 … Sunday 7. ISO 8601 puts that
/// day in week 1 by definition, so it is where every week date is
/// measured from.
fn january_fourth_weekday(year: i64) -> i64 {
    (last_day_of_year(year - 1) + 3).rem_euclid(7) + 1
}

/// 52, or 53 for a year that begins on a Thursday or a leap year that
/// begins on a Wednesday.
fn weeks_in_year(year: i64) -> i64 {
    if last_day_of_year(year) == 4 || last_day_of_year(year - 1) == 3 {
        53
    } else {
        52
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::time;

    /// Every case here resolves in a named zone rather than the
    /// machine's. `TZ` is honoured on Unix and ignored on Windows, and
    /// this has to mean the same thing on all three platforms.
    fn in_new_york<T>(body: impl FnOnce() -> T) -> T {
        let zone: chrono_tz::Tz = "America/New_York".parse().expect("a real timezone");
        time::with_zone(zone, body)
    }

    /// The instant `2024-01-15` resolves to: UTC midnight, because a
    /// date-only string is UTC.
    const JANUARY_FIFTEENTH: i64 = 1_705_276_800_000;

    #[test]
    fn a_week_date_is_the_monday_of_that_week() {
        // 2024 begins on a Monday, so week 1 begins on 1 January and
        // week 3 on the fifteenth.
        assert_eq!(
            in_new_york(|| week_date("2024-W03")),
            Some(JANUARY_FIFTEENTH)
        );
        assert_eq!(
            in_new_york(|| week_date("2024-W03-1")),
            Some(JANUARY_FIFTEENTH)
        );
    }

    #[test]
    fn the_day_of_the_week_moves_it() {
        let monday = in_new_york(|| week_date("2024-W03-1")).expect("a monday");
        let sunday = in_new_york(|| week_date("2024-W03-7")).expect("a sunday");
        assert_eq!(sunday - monday, 6 * 86_400_000);
    }

    /// Both directions a week can cross a year boundary, which is the
    /// only reason this needs a calculation rather than a lookup.
    #[test]
    fn a_week_can_begin_in_the_previous_year_and_end_in_the_next() {
        // 2015-W01-1 is 29 December 2014.
        assert_eq!(
            in_new_york(|| week_date("2015-W01-1")),
            in_new_york(|| date_parse("2014-12-29"))
        );
        // 2020-W53-7 is 3 January 2021.
        assert_eq!(
            in_new_york(|| week_date("2020-W53-7")),
            in_new_york(|| date_parse("2021-01-03"))
        );
    }

    #[test]
    fn a_year_without_a_fifty_third_week_refuses_one() {
        assert_eq!(weeks_in_year(2020), 53, "2020 has one");
        assert_eq!(weeks_in_year(2024), 52, "2024 does not");
        assert_eq!(in_new_york(|| week_date("2024-W53")), None);
        assert!(in_new_york(|| week_date("2020-W53")).is_some());
    }

    #[test]
    fn a_week_or_a_day_outside_its_range_is_a_refusal() {
        for value in ["2024-W00", "2024-W99", "2024-W03-0", "2024-W03-8"] {
            assert_eq!(in_new_york(|| week_date(value)), None, "{value}");
        }
    }

    #[test]
    fn an_ordinal_date_counts_days_from_the_first() {
        assert_eq!(
            in_new_york(|| ordinal_date("2024-015")),
            Some(JANUARY_FIFTEENTH)
        );
        assert_eq!(
            in_new_york(|| ordinal_date("2024-001")),
            in_new_york(|| date_parse("2024-01-01"))
        );
    }

    /// The leap year is the case a naive month table gets wrong.
    #[test]
    fn the_sixtieth_day_depends_on_the_leap_year() {
        assert_eq!(
            in_new_york(|| ordinal_date("2024-060")),
            in_new_york(|| date_parse("2024-02-29"))
        );
        assert_eq!(
            in_new_york(|| ordinal_date("2023-060")),
            in_new_york(|| date_parse("2023-03-01"))
        );
    }

    #[test]
    fn a_day_the_year_does_not_have_is_a_refusal() {
        assert_eq!(in_new_york(|| ordinal_date("2023-366")), None);
        assert!(in_new_york(|| ordinal_date("2024-366")).is_some());
        assert_eq!(in_new_york(|| ordinal_date("2024-000")), None);
        assert_eq!(in_new_york(|| ordinal_date("2024-400")), None);
        assert_eq!(in_new_york(|| ordinal_date("nonsense")), None);
    }

    #[test]
    fn the_basic_date_form_is_the_extended_one() {
        assert_eq!(
            in_new_york(|| basic_format("20240115")),
            Some(JANUARY_FIFTEENTH)
        );
    }

    /// A date-time carries its own evidence, so the same instants come
    /// back as the extended form gives.
    #[test]
    fn the_basic_date_time_form_keeps_every_zone_rule() {
        for (basic, extended) in [
            ("20240115T103045Z", "2024-01-15T10:30:45Z"),
            ("20240115T103045", "2024-01-15T10:30:45"),
            ("20240115T103045.123Z", "2024-01-15T10:30:45.123Z"),
            ("20240115T103045+0530", "2024-01-15T10:30:45+05:30"),
            ("20240115T103045-0800", "2024-01-15T10:30:45-08:00"),
            ("20240115T103045+05", "2024-01-15T10:30:45+05:00"),
        ] {
            assert_eq!(
                in_new_york(|| basic_format(basic)),
                in_new_york(|| date_parse(extended)),
                "{basic}"
            );
        }
    }

    /// Without the window every eight-digit identifier that happens to
    /// hold a legal month and day would be a date.
    #[test]
    fn an_eight_digit_run_outside_the_plausible_years_is_not_a_date() {
        assert_eq!(in_new_york(|| basic_format("98765432")), None);
        assert_eq!(in_new_york(|| basic_format("18991231")), None);
        assert!(in_new_york(|| basic_format("19000101")).is_some());
        assert!(in_new_york(|| basic_format("20991231")).is_some());
    }

    #[test]
    fn a_month_or_day_that_cannot_exist_is_a_refusal() {
        for value in ["20245601", "20240132", "20240100", "20241301"] {
            assert_eq!(in_new_york(|| basic_format(value)), None, "{value}");
        }
    }

    /// Found by the fuzz target, which reaches these functions directly
    /// where the patterns can only hand them a fixed shape. A nineteen
    /// digit year overflowed the weekday arithmetic; the width check is
    /// what the extension's anchored regex was already doing.
    #[test]
    fn a_numeral_of_the_wrong_width_is_a_refusal() {
        for value in [
            "-7531464512345672024-W03-1",
            "99999-W03-1",
            "999-W03-1",
            "2024-W3-1",
            "2024-W003-1",
            "+024-W03-1",
        ] {
            assert_eq!(in_new_york(|| week_date(value)), None, "{value}");
        }
        for value in ["99999-015", "2024-15", "2024-0015", "-999-015"] {
            assert_eq!(in_new_york(|| ordinal_date(value)), None, "{value}");
        }
        assert_eq!(in_new_york(|| basic_format("+0240115")), None);
    }

    #[test]
    fn a_malformed_basic_string_is_a_refusal() {
        for value in [
            "2024",
            "20240115X103045",
            "20240115T1030",
            "20240115T103045+0",
        ] {
            assert_eq!(in_new_york(|| basic_format(value)), None, "{value}");
        }
    }

    /// The window applies to the bare form only. A date-time says what
    /// it is.
    #[test]
    fn the_year_window_does_not_reach_the_date_time_form() {
        assert!(in_new_york(|| basic_format("18991231T103045Z")).is_some());
    }

    #[test]
    fn a_zone_v8_does_not_know_resolves_to_its_fixed_offset() {
        for (abbreviation, offset) in [
            ("CEST", "+0200"),
            ("CET", "+0100"),
            ("BST", "+0100"),
            ("JST", "+0900"),
            ("AEST", "+1000"),
            ("IST", "+0530"),
        ] {
            let named = format!("Mon, 15 Jan 2024 10:30:45 {abbreviation}");
            let numeric = format!("Mon, 15 Jan 2024 10:30:45 {offset}");
            assert_eq!(
                in_new_york(|| instant(&named)),
                in_new_york(|| date_parse(&numeric)),
                "{abbreviation}"
            );
        }
    }

    /// V8 answers first, so this layer can only turn a refusal into a
    /// value — never a value into a different one.
    #[test]
    fn a_string_v8_reads_is_left_alone() {
        let value = "Mon, 15 Jan 2024 10:30:45 EST";
        assert_eq!(
            in_new_york(|| instant(value)),
            in_new_york(|| date_parse(value))
        );
    }

    /// A keyword matches on three letters in V8, so a substring match
    /// here would read `HISTORY` as India.
    #[test]
    fn an_abbreviation_inside_a_longer_word_is_not_a_zone() {
        assert_eq!(
            in_new_york(|| instant("Mon, 15 Jan 2024 10:30:45 HISTORY")),
            None
        );
        assert_eq!(in_new_york(|| with_numeric_zone("HISTORY")), None);
    }

    #[test]
    fn a_string_with_no_zone_word_at_all_is_still_a_refusal() {
        assert_eq!(in_new_york(|| instant("not a date")), None);
        assert_eq!(in_new_york(|| with_numeric_zone("2024")), None);
    }

    /// The abbreviation is replaced where it stands, so what surrounds
    /// it still has to parse.
    #[test]
    fn the_rewrite_keeps_the_rest_of_the_string() {
        assert_eq!(
            with_numeric_zone("Mon, 15 Jan 2024 10:30:45 CEST").as_deref(),
            Some("Mon, 15 Jan 2024 10:30:45 +0200")
        );
        assert_eq!(
            with_numeric_zone("cest at the front").as_deref(),
            Some("+0200 at the front")
        );
    }

    #[test]
    fn the_calendar_helpers_agree_with_the_calendar() {
        assert!(is_leap(2024) && is_leap(2000));
        assert!(!is_leap(2023) && !is_leap(1900));
        assert_eq!(days_in_year(2024), 366);
        assert_eq!(days_in_year(2023), 365);
        // 1 January 2024 was a Monday, so 4 January was a Thursday.
        assert_eq!(january_fourth_weekday(2024), 4);
        // 4 January 2021 was a Monday, and 4 January 2015 a Sunday.
        assert_eq!(january_fourth_weekday(2021), 1);
        assert_eq!(january_fourth_weekday(2015), 7);
        assert_eq!(month_and_day(2024, 1), Some((1, 1)));
        assert_eq!(month_and_day(2024, 366), Some((12, 31)));
        assert_eq!(month_and_day(2024, 367), None);
    }
}
