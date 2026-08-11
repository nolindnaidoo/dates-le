//! Turning date components into an instant.
//!
//! Two directions, and the difference between them is the whole reason
//! this file exists: a date-only string is UTC, and a date-time string
//! with no offset is *local* — the machine's, with its daylight-saving
//! history. `2024-01-15` and `2024-01-15T00:00:00` are not the same
//! instant, and a tool that conflated them would quietly misreport
//! every zone-less timestamp in a codebase.

use chrono::{Local, MappedLocalTime, TimeZone, Timelike};

/// The range a `Date` can hold, ECMA-262 §21.4.1.1. Beyond it every
/// operation is `NaN`, so beyond it this returns `None`.
const MAX_TIME_VALUE: i64 = 8_640_000_000_000_000;

/// A parsed date, before it becomes an instant.
///
/// Components are stored as parsed, not as validated: the parsers
/// enforce the ranges their grammars require, and the arithmetic here
/// deliberately allows what is left to roll over — `2024-02-30` is
/// 1 March, because that is what `MakeDay` does and therefore what V8
/// answers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Components {
    pub(crate) year: i64,
    pub(crate) month: i64,
    pub(crate) day: i64,
    pub(crate) hour: i64,
    pub(crate) minute: i64,
    pub(crate) second: i64,
    pub(crate) millisecond: i64,
    /// Minutes east of UTC. `None` means the string carried no zone, so
    /// the instant is whatever the machine says it is.
    pub(crate) offset_minutes: Option<i64>,
}

impl Components {
    /// A date at midnight, for tests that care only about the calendar
    /// arithmetic.
    #[cfg(test)]
    pub(crate) fn date(year: i64, month: i64, day: i64) -> Self {
        Self {
            year,
            month,
            day,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
            offset_minutes: None,
        }
    }

    /// Resolve to epoch milliseconds, or `None` where V8 answers `NaN`.
    pub(crate) fn to_timestamp(self) -> Option<i64> {
        let days = days_from_civil(self.year, self.month, self.day)?;
        let time =
            self.hour * 3_600_000 + self.minute * 60_000 + self.second * 1_000 + self.millisecond;
        let naive = days.checked_mul(86_400_000)?.checked_add(time)?;

        let utc = match self.offset_minutes {
            Some(offset) => naive.checked_sub(offset.checked_mul(60_000)?)?,
            None => local_to_utc(naive)?,
        };

        (utc.abs() <= MAX_TIME_VALUE).then_some(utc)
    }
}

/// Days since 1970-01-01 for a proleptic Gregorian date, with month and
/// day allowed to fall outside their natural range so they roll over.
///
/// Howard Hinnant's `days_from_civil`, with the month normalised first
/// because `MakeDay` takes `MonthFromTime` modulo 12 and carries the
/// remainder into the year.
fn days_from_civil(year: i64, month: i64, day: i64) -> Option<i64> {
    // month is 1-based here; shift to 0-based for the modulo, and let a
    // month outside 1..=12 carry into the year the way MakeDay does.
    let zero_based = month.checked_sub(1)?;
    let year = year.checked_add(zero_based.div_euclid(12))?;
    let month = zero_based.rem_euclid(12) + 1;

    // Days for the first of that month, then add (day - 1) so a day
    // beyond the month's length rolls into the next one.
    let shifted_year = if month <= 2 { year - 1 } else { year };
    let era = shifted_year.div_euclid(400);
    let year_of_era = shifted_year - era * 400;
    let day_of_year = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let first_of_month = era * 146_097 + day_of_era - 719_468;

    first_of_month.checked_add(day.checked_sub(1)?)
}

/// A local-time value to a UTC instant, matching V8 at a daylight-saving
/// transition.
///
/// Both edges resolve the same way: **the offset in force before the
/// transition wins**. For the hour that does not exist that is the only
/// sane reading; for the hour that happens twice it is the earlier of
/// the two, which is what V8 answers and is checked against it in
/// `fixtures/date-parse.json`.
///
/// The offset a day earlier is what "before the transition" means in
/// practice. Transitions are months apart and never longer than an
/// hour, so a day is far enough to be outside one and close enough to
/// be inside the same rule.
fn local_to_utc(naive_millis: i64) -> Option<i64> {
    let naive = chrono::DateTime::from_timestamp_millis(naive_millis)?.naive_utc();

    match Local.from_local_datetime(&naive) {
        MappedLocalTime::Single(resolved) => Some(resolved.timestamp_millis()),
        // Ambiguous or nonexistent: fall back to the offset that was in
        // force a day earlier, which is the pre-transition one.
        MappedLocalTime::Ambiguous(..) | MappedLocalTime::None => {
            let day_before = naive.checked_sub_signed(chrono::Duration::days(1))?;
            let offset = Local
                .from_local_datetime(&day_before)
                .earliest()?
                .offset()
                .local_minus_utc();
            naive_millis.checked_sub(i64::from(offset) * 1_000)
        }
    }
}

/// The year the machine currently thinks it is.
///
/// Only a syslog line needs this — it carries no year — which makes it
/// the one place extraction depends on a clock. `--year` overrides it
/// so a corpus can pin it.
pub(crate) fn current_year() -> i64 {
    i64::from(chrono::Datelike::year(&Local::now()))
}

/// Render an instant as a UTC ISO 8601 string, for `--iso`.
pub(crate) fn to_iso(timestamp: i64) -> Option<String> {
    let moment = chrono::DateTime::from_timestamp_millis(timestamp)?;
    Some(if moment.nanosecond() % 1_000_000_000 == 0 {
        moment.format("%Y-%m-%dT%H:%M:%SZ").to_string()
    } else {
        moment.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(year: i64, month: i64, day: i64) -> Option<i64> {
        let mut components = Components::date(year, month, day);
        components.offset_minutes = Some(0);
        components.to_timestamp()
    }

    #[test]
    fn the_epoch_is_zero() {
        assert_eq!(utc(1970, 1, 1), Some(0));
    }

    #[test]
    fn dates_before_the_epoch_are_negative() {
        assert_eq!(utc(1969, 12, 31), Some(-86_400_000));
    }

    /// The arithmetic rolls over, because `MakeDay` does and V8
    /// therefore answers 1 March for both of these.
    #[test]
    fn a_day_past_the_end_of_the_month_rolls_over() {
        assert_eq!(utc(2024, 2, 30), utc(2024, 3, 1));
        assert_eq!(utc(2023, 2, 29), utc(2023, 3, 1));
    }

    #[test]
    fn a_leap_day_that_exists_does_not_roll_over() {
        assert_eq!(utc(2024, 2, 29), Some(1_709_164_800_000));
    }

    #[test]
    fn centuries_divisible_by_four_hundred_are_leap_years() {
        assert_eq!(utc(2000, 2, 29), utc(2000, 2, 29));
        assert_ne!(utc(1900, 2, 29), utc(1900, 2, 28));
    }

    #[test]
    fn a_month_outside_the_year_carries_into_it() {
        assert_eq!(utc(2024, 13, 1), utc(2025, 1, 1));
        assert_eq!(utc(2024, 0, 1), utc(2023, 12, 1));
    }

    #[test]
    fn beyond_the_representable_range_there_is_no_instant() {
        assert_eq!(utc(300_000, 1, 1), None);
        assert_eq!(utc(-300_000, 1, 1), None);
    }

    #[test]
    fn an_instant_renders_as_iso() {
        assert_eq!(to_iso(0).as_deref(), Some("1970-01-01T00:00:00Z"));
        assert_eq!(
            to_iso(1_705_314_645_123).as_deref(),
            Some("2024-01-15T10:30:45.123Z")
        );
    }
}
