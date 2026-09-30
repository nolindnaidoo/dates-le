//! Regional notations: numeric dates with the day or the month first,
//! and dates that spell the month out — the port of the extension's
//! `src/extraction/regional.ts`.
//!
//! These are resolved here rather than by the `Date.parse` port, which
//! reads only month-first slashes, refuses `15/01/2024` and knows nothing
//! of `15.01.2024`.
//!
//! **The order is read from the value when the value says it.** A number
//! over 12 can only be a day, so `15/01/2024` and `1/15/2024` each
//! resolve one way whatever the caller asked. Only when both numbers fit
//! a month is the order a choice, and then it is the caller's
//! [`DateOrder`] — except for dots, which no convention writes month
//! first.
//!
//! Every value is checked as a calendar date. `31/02/2024` is refused
//! rather than rolled into March, and a numeric year outside 1900–2099
//! is refused, which keeps version strings such as `1.2.3000` out.

use super::time::Components;

/// How to read a numeric date whose day and month could be either way
/// round.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) enum DateOrder {
    #[default]
    MonthFirst,
    DayFirst,
}

impl DateOrder {
    /// The name the CLI flag and the MCP argument both take.
    pub(crate) fn parse(name: &str) -> Option<Self> {
        match name {
            "mdy" => Some(Self::MonthFirst),
            "dmy" => Some(Self::DayFirst),
            _ => None,
        }
    }
}

const MONTHS: [&str; 12] = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];

/// A numeric date, in either order; `None` when it is not a real one.
///
/// The pattern that found `value` has already fixed its shape — digits,
/// one separator used twice, a four-digit year and an optional clock —
/// so this reads it positionally rather than matching it again.
pub(crate) fn numeric_date(value: &str, order: DateOrder) -> Option<i64> {
    let mut rest = value;
    let first = take_number(&mut rest, 2)?;
    let separator = rest.chars().next()?;
    rest = &rest[separator.len_utf8()..];
    let second = take_number(&mut rest, 2)?;
    rest = rest.get(1..)?;
    let year = take_number(&mut rest, 4)?;
    if !(1900..=2099).contains(&year) {
        return None;
    }

    let day_first =
        first > 12 || (second <= 12 && (separator == '.' || order == DateOrder::DayFirst));
    let (day, month) = if day_first {
        (first, second)
    } else {
        (second, first)
    };

    let (hour, minute, second_of_minute) = clock(rest)?;
    local_instant(year, month, day, hour, minute, second_of_minute)
}

/// A date with its month written out: `15 Jan 2024`, `15th January,
/// 2024`, `15-Jan-2024`, `Jan 15, 2024`, `January 15th 2024`.
pub(crate) fn written_date(value: &str) -> Option<i64> {
    let year: i64 = value.get(value.len().checked_sub(4)?..)?.parse().ok()?;
    let digits_at = value.find(|c: char| c.is_ascii_digit())?;
    let mut rest = &value[digits_at..];
    let day = take_number(&mut rest, 2)?;

    // The first run of letters that does not follow a digit: a run that
    // does is an ordinal suffix, `15th`.
    let bytes = value.as_bytes();
    let mut month = None;
    let mut index = 0;
    while index < bytes.len() {
        if !bytes[index].is_ascii_alphabetic() {
            index += 1;
            continue;
        }
        let start = index;
        while index < bytes.len() && bytes[index].is_ascii_alphabetic() {
            index += 1;
        }
        let suffix = start > 0 && bytes[start - 1].is_ascii_digit();
        if !suffix && index - start >= 3 {
            let name = value[start..start + 3].to_ascii_lowercase();
            month = MONTHS.iter().position(|m| *m == name);
            break;
        }
    }
    let month = i64::try_from(month? + 1).ok()?;
    if year < 1000 {
        return None;
    }
    local_instant(year, month, day, 0, 0, 0)
}

/// Up to `width` leading ASCII digits, consumed from `rest`.
fn take_number(rest: &mut &str, width: usize) -> Option<i64> {
    let length = rest
        .bytes()
        .take(width)
        .take_while(u8::is_ascii_digit)
        .count();
    if length == 0 {
        return None;
    }
    let number = rest[..length].parse().ok()?;
    *rest = &rest[length..];
    Some(number)
}

/// The optional clock after a numeric date: nothing, or one space
/// character, `H:MM`, optional `:SS`, and an optional meridiem after at
/// most one more space character.
fn clock(rest: &str) -> Option<(i64, i64, i64)> {
    let Some(space) = rest.chars().next() else {
        return Some((0, 0, 0));
    };
    let mut rest = &rest[space.len_utf8()..];
    let mut hour = take_number(&mut rest, 2)?;
    rest = rest.strip_prefix(':')?;
    let minute = take_exact(&mut rest, 2)?;
    let second = match rest.strip_prefix(':') {
        Some(after) => {
            rest = after;
            take_exact(&mut rest, 2)?
        }
        None => 0,
    };

    if let Some(next) = rest.chars().next() {
        if !matches!(next, 'A' | 'a' | 'P' | 'p') {
            rest = &rest[next.len_utf8()..];
        }
        let mut letters = rest.chars();
        let meridiem = letters.next()?;
        if !matches!(letters.next(), Some('M' | 'm')) || letters.next().is_some() {
            return None;
        }
        if !(1..=12).contains(&hour) {
            return None;
        }
        let pm = matches!(meridiem, 'P' | 'p');
        hour = hour % 12 + if pm { 12 } else { 0 };
    }

    (hour <= 23 && minute <= 59 && second <= 59).then_some((hour, minute, second))
}

fn take_exact(rest: &mut &str, width: usize) -> Option<i64> {
    let before = rest.len();
    let number = take_number(rest, width)?;
    (before - rest.len() == width).then_some(number)
}

fn local_instant(
    year: i64,
    month: i64,
    day: i64,
    hour: i64,
    minute: i64,
    second: i64,
) -> Option<i64> {
    if !(1..=12).contains(&month) || day < 1 || day > days_in_month(year, month) {
        return None;
    }
    Components {
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond: 0,
        offset_minutes: None,
    }
    .to_timestamp()
}

fn days_in_month(year: i64, month: i64) -> i64 {
    match month {
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::time::with_zone;

    fn local(year: i64, month: i64, day: i64, hour: i64, minute: i64) -> i64 {
        Components {
            year,
            month,
            day,
            hour,
            minute,
            second: 0,
            millisecond: 0,
            offset_minutes: None,
        }
        .to_timestamp()
        .expect("a real date")
    }

    fn in_new_york<T>(body: impl FnOnce() -> T) -> T {
        with_zone("America/New_York".parse().expect("a zone"), body)
    }

    #[test]
    fn the_value_decides_when_only_one_reading_is_a_date() {
        in_new_york(|| {
            for order in [DateOrder::MonthFirst, DateOrder::DayFirst] {
                assert_eq!(
                    numeric_date("15/01/2024", order),
                    Some(local(2024, 1, 15, 0, 0))
                );
                assert_eq!(
                    numeric_date("1/15/2024", order),
                    Some(local(2024, 1, 15, 0, 0))
                );
            }
        });
    }

    #[test]
    fn the_order_decides_an_ambiguous_value_except_for_dots() {
        in_new_york(|| {
            assert_eq!(
                numeric_date("05/01/2024", DateOrder::MonthFirst),
                Some(local(2024, 5, 1, 0, 0))
            );
            assert_eq!(
                numeric_date("05-01-2024", DateOrder::DayFirst),
                Some(local(2024, 1, 5, 0, 0))
            );
            assert_eq!(
                numeric_date("05.01.2024", DateOrder::MonthFirst),
                Some(local(2024, 1, 5, 0, 0))
            );
        });
    }

    #[test]
    fn a_clock_is_read_with_or_without_seconds_and_a_meridiem() {
        in_new_york(|| {
            assert_eq!(
                numeric_date("15.01.2024 10:30", DateOrder::MonthFirst),
                Some(local(2024, 1, 15, 10, 30))
            );
            assert_eq!(
                numeric_date("1/15/2024 3:30 PM", DateOrder::MonthFirst),
                Some(local(2024, 1, 15, 15, 30))
            );
            assert_eq!(
                numeric_date("1/15/2024 12:05am", DateOrder::MonthFirst),
                Some(local(2024, 1, 15, 0, 5))
            );
        });
    }

    #[test]
    fn what_is_not_a_real_date_is_refused_rather_than_rolled_over() {
        for value in [
            "31/02/2024",
            "13/13/2024",
            "0/5/2024",
            "29/02/2023",
            "1/15/2024 24:00",
            "1/15/2024 13:00 PM",
            "1/1/1899",
            "1.2.3000",
        ] {
            assert_eq!(numeric_date(value, DateOrder::DayFirst), None, "{value}");
        }
        assert_eq!(written_date("31 Apr 2024"), None);
    }

    #[test]
    fn a_written_month_is_read_in_either_position() {
        in_new_york(|| {
            for value in [
                "15 Jan 2024",
                "15th January, 2024",
                "15-JAN-2024",
                "Jan 15, 2024",
                "January 15th 2024",
                "Jan. 15, 2024",
            ] {
                assert_eq!(
                    written_date(value),
                    Some(local(2024, 1, 15, 0, 0)),
                    "{value}"
                );
            }
            assert_eq!(written_date("1 Sept 2024"), Some(local(2024, 9, 1, 0, 0)));
        });
    }
}
