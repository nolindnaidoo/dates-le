//! `Date.parse`, as V8 implements it.
//!
//! The extension resolves every instant with `Date.parse` in V8. A date
//! that resolves in one frontend and not the other is not a rounding
//! difference — the value is *dropped* when its instant cannot be
//! resolved, so a parser that is merely close produces a different set
//! of findings. That is why this is written out rather than delegated
//! to a date library: none is bug-compatible with V8, and being
//! bug-compatible is the requirement.
//!
//! Two parsers, tried in order, exactly as `DateParser::Parse` does:
//!
//! 1. **The Date Time String Format** (ECMA-262 §21.4.1.32). It gives up
//!    cleanly while it is still reading the date — handing what it has
//!    to the legacy parser — but once it sees the `T` it has committed,
//!    and anything unexpected after that is a refusal rather than a
//!    fallback. `2024-01-15T10:30:45 GMT` is a refusal for that reason,
//!    while `2024-01-15 10:30:45` is read by the legacy parser and is
//!    fine.
//! 2. **The legacy parser**, which no standard describes. Its rules were
//!    established by asking V8 and are pinned in
//!    `fixtures/date-parse.json`; every claim in the comments below is a
//!    case in that file.
//!
//! The two disagree about the default zone, which is the single most
//! consequential thing here: a date-only ISO string is **UTC**, and
//! everything the legacy parser reads is **local**. `2024-01-15` and
//! `January 15 2024` are the same date and not the same instant.

use super::time::Components;

/// V8 keeps nine significant digits of any numeral and discards the rest.
const MAX_SIGNIFICANT_DIGITS: usize = 9;

/// Resolve a string to epoch milliseconds, or `None` where V8 gives `NaN`.
pub(crate) fn date_parse(input: &str) -> Option<i64> {
    let tokens = tokenize(input);
    let mut cursor = Cursor::new(&tokens);

    let mut day = DayComposer::default();
    let mut time = TimeComposer::default();
    let mut zone = ZoneComposer::default();

    match parse_iso(&mut cursor, &mut day, &mut time, &mut zone) {
        IsoOutcome::Refused => return None,
        IsoOutcome::Complete => {}
        IsoOutcome::Continue => parse_legacy(&mut cursor, &mut day, &mut time, &mut zone)?,
    }

    let (year, month, date) = day.write()?;
    let (hour, minute, second, millisecond) = time.write()?;
    Components {
        year,
        month,
        day: date,
        hour,
        minute,
        second,
        millisecond,
        offset_minutes: match zone.write()? {
            Offset::Local => None,
            Offset::Minutes(minutes) => Some(minutes),
        },
    }
    .to_timestamp()
}

// --- tokens ----------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Token {
    /// A run of digits: its value, and how many characters it occupied.
    /// The two differ — `0800` is 800 across four characters — and both
    /// matter: the value is the number, the width is what tells `+0800`
    /// (hours and minutes) from `+08` (hours).
    Number {
        value: i64,
        width: usize,
    },
    Symbol(char),
    /// A run of letters. Unknown words are still keywords, of kind
    /// `Unknown`, because where they may appear is a rule of its own.
    Keyword(Keyword),
    Whitespace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Keyword {
    Month(i64),
    /// The offset a name stands for, in hours. These are fixed, not
    /// zone-aware: `EST` is −5 in July as much as in January.
    Zone(i64),
    /// The hours to add: `am` contributes nothing, `pm` twelve.
    Meridiem(i64),
    TimeSeparator,
    Unknown,
}

/// V8's keyword table. A word matches on its **first three letters**, so
/// `Janxxx` is January and `Ja` is nothing at all. Entries shorter than
/// three characters match only a word of exactly that length, which is
/// why `z` is a zone and `zz` is not.
fn keyword(word: &str) -> Keyword {
    const MONTHS: [&str; 12] = [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    let lower = word.to_ascii_lowercase();

    match lower.as_str() {
        "am" => return Keyword::Meridiem(0),
        "pm" => return Keyword::Meridiem(12),
        "t" => return Keyword::TimeSeparator,
        "z" | "ut" | "utc" => return Keyword::Zone(0),
        _ => {}
    }
    if lower.len() < 3 {
        return Keyword::Unknown;
    }
    let head = &lower[..3];
    if let Some(index) = MONTHS.iter().position(|month| *month == head) {
        return Keyword::Month(index as i64 + 1);
    }
    match head {
        "gmt" => Keyword::Zone(0),
        "edt" => Keyword::Zone(-4),
        "est" | "cdt" => Keyword::Zone(-5),
        "cst" | "mdt" => Keyword::Zone(-6),
        "mst" | "pdt" => Keyword::Zone(-7),
        "pst" => Keyword::Zone(-8),
        _ => Keyword::Unknown,
    }
}

fn tokenize(input: &str) -> Vec<Token> {
    let characters: Vec<char> = input.chars().collect();
    let mut tokens = Vec::new();
    let mut index = 0;

    while index < characters.len() {
        let character = characters[index];
        if character.is_ascii_digit() {
            let start = index;
            while index < characters.len() && characters[index].is_ascii_digit() {
                index += 1;
            }
            let digits = &characters[start..index];
            let mut value: i64 = 0;
            for (significant, digit) in digits.iter().skip_while(|digit| **digit == '0').enumerate()
            {
                if significant < MAX_SIGNIFICANT_DIGITS {
                    value = value * 10 + i64::from(*digit as u8 - b'0');
                }
            }
            tokens.push(Token::Number {
                value,
                width: digits.len(),
            });
        } else if character.is_alphabetic() {
            let start = index;
            while index < characters.len() && characters[index].is_alphabetic() {
                index += 1;
            }
            let word: String = characters[start..index].iter().collect();
            tokens.push(Token::Keyword(keyword(&word)));
        } else if character == '(' {
            // A parenthesised comment is skipped whole, nesting and all,
            // and an unclosed one runs to the end. It stands in as
            // whitespace so it still separates what is either side of
            // it — which is how `... GMT+0000 (Coordinated Universal
            // Time)` parses despite ending in three garbage words.
            let mut depth = 0;
            while index < characters.len() {
                match characters[index] {
                    '(' => depth += 1,
                    ')' => depth -= 1,
                    _ => {}
                }
                index += 1;
                if depth == 0 {
                    break;
                }
            }
            tokens.push(Token::Whitespace);
        } else if character.is_whitespace() {
            index += 1;
            tokens.push(Token::Whitespace);
        } else {
            index += 1;
            tokens.push(Token::Symbol(character));
        }
    }
    tokens
}

/// A position in the token stream.
///
/// Whitespace is a token like any other and lookahead never skips it —
/// it is what separates a garbage word from the first number, and its
/// presence or absence decides which of the two parsers reads a string.
#[derive(Clone, Copy)]
struct Cursor<'a> {
    tokens: &'a [Token],
    index: usize,
}

impl<'a> Cursor<'a> {
    fn new(tokens: &'a [Token]) -> Self {
        Self { tokens, index: 0 }
    }

    fn next(&mut self) -> Option<Token> {
        let token = self.tokens.get(self.index).copied();
        if token.is_some() {
            self.index += 1;
        }
        token
    }

    fn peek(&self) -> Option<Token> {
        self.tokens.get(self.index).copied()
    }

    /// Consume the next token if it is this symbol.
    ///
    /// Deliberately not whitespace-tolerant: `10 : 30` is not a time,
    /// and more consequentially `2024-01-15 ` is not the ISO grammar,
    /// which is why it resolves to local midnight where `2024-01-15`
    /// resolves to UTC midnight — five hours apart, on one trailing
    /// space.
    fn skip_symbol(&mut self, symbol: char) -> bool {
        if self.peek() == Some(Token::Symbol(symbol)) {
            self.index += 1;
            return true;
        }
        false
    }

    fn at_end(&self) -> bool {
        self.peek().is_none()
    }
}

// --- the Date Time String Format -------------------------------------------

enum IsoOutcome {
    /// The whole string was the ISO grammar.
    Complete,
    /// Not the ISO grammar; whatever was read is the legacy parser's to
    /// finish, and the cursor is where it should resume.
    Continue,
    /// It *was* the ISO grammar and then stopped being one. Past the
    /// time separator there is no falling back.
    Refused,
}

fn parse_iso(
    cursor: &mut Cursor,
    day: &mut DayComposer,
    time: &mut TimeComposer,
    zone: &mut ZoneComposer,
) -> IsoOutcome {
    // The year: four digits, or six with an explicit sign.
    match cursor.peek() {
        Some(Token::Symbol(sign @ ('+' | '-'))) => {
            let mut probe = *cursor;
            probe.index += 1;
            match probe.peek() {
                Some(Token::Number { value, width: 6 }) => {
                    // "-000000" is not a year, so it is not this grammar.
                    if sign == '-' && value == 0 {
                        return IsoOutcome::Continue;
                    }
                    cursor.index = probe.index + 1;
                    day.push(if sign == '-' { -value } else { value });
                }
                _ => return IsoOutcome::Continue,
            }
        }
        Some(Token::Number { value, width: 4 }) => {
            cursor.index += 1;
            day.push(value);
        }
        _ => return IsoOutcome::Continue,
    }

    // Month and day, each two digits and each in range, or this is not
    // the ISO grammar after all and the legacy parser takes over with
    // the year already read.
    if cursor.skip_symbol('-') {
        match cursor.peek() {
            Some(Token::Number { value, width: 2 }) if (1..=12).contains(&value) => {
                cursor.index += 1;
                day.push(value);
            }
            _ => return IsoOutcome::Continue,
        }
        if cursor.skip_symbol('-') {
            match cursor.peek() {
                Some(Token::Number { value, width: 2 }) if (1..=31).contains(&value) => {
                    cursor.index += 1;
                    day.push(value);
                }
                _ => return IsoOutcome::Continue,
            }
        }
    }

    parse_iso_time(cursor, day, time, zone)
}

/// The time part, which is where the grammar stops being able to fall
/// back: past the `T`, anything unexpected is a refusal.
fn parse_iso_time(
    cursor: &mut Cursor,
    day: &mut DayComposer,
    time: &mut TimeComposer,
    zone: &mut ZoneComposer,
) -> IsoOutcome {
    if !matches!(cursor.peek(), Some(Token::Keyword(Keyword::TimeSeparator))) {
        if !cursor.at_end() {
            return IsoOutcome::Continue;
        }
        // A date with no time is UTC — the one place these two parsers
        // give the same string different instants.
        day.iso = true;
        zone.set(0);
        return IsoOutcome::Complete;
    }
    cursor.index += 1;

    let read_two = |cursor: &mut Cursor, high: i64| -> Option<i64> {
        match cursor.peek() {
            Some(Token::Number { value, width: 2 }) if (0..=high).contains(&value) => {
                cursor.index += 1;
                Some(value)
            }
            _ => None,
        }
    };

    let Some(hour) = read_two(cursor, 24) else {
        return IsoOutcome::Refused;
    };
    if !cursor.skip_symbol(':') {
        return IsoOutcome::Refused;
    }
    let Some(minute) = read_two(cursor, 59) else {
        return IsoOutcome::Refused;
    };
    time.push(hour);
    time.push(minute);

    if cursor.skip_symbol(':') {
        let Some(second) = read_two(cursor, 59) else {
            return IsoOutcome::Refused;
        };
        time.push(second);
        if cursor.skip_symbol('.') {
            // The grammar says three digits. V8 accepts any number of
            // them and keeps the first three, so `.1` is 100ms and
            // `.123456` is 123ms — truncated, never rounded.
            match cursor.peek() {
                Some(Token::Number { .. }) => {
                    let text = cursor.digits_at(cursor.index);
                    cursor.index += 1;
                    let mut millis = 0;
                    for position in 0..3 {
                        let digit = text
                            .as_bytes()
                            .get(position)
                            .map_or(0, |byte| i64::from(byte.saturating_sub(b'0')).clamp(0, 9));
                        millis = millis * 10 + digit;
                    }
                    time.push(millis);
                }
                _ => return IsoOutcome::Refused,
            }
        }
    }

    // The zone, if there is one; otherwise local.
    match cursor.peek() {
        Some(Token::Keyword(Keyword::Zone(0))) => {
            cursor.index += 1;
            zone.set(0);
        }
        Some(Token::Symbol(sign @ ('+' | '-'))) => {
            cursor.index += 1;
            let Some(Token::Number { value: hour, .. }) = cursor.peek() else {
                return IsoOutcome::Refused;
            };
            cursor.index += 1;
            if !cursor.skip_symbol(':') {
                return IsoOutcome::Refused;
            }
            let Some(Token::Number { value: minute, .. }) = cursor.peek() else {
                return IsoOutcome::Refused;
            };
            cursor.index += 1;
            if !(0..=23).contains(&hour) || !(0..=59).contains(&minute) {
                return IsoOutcome::Refused;
            }
            let total = hour * 60 + minute;
            zone.minutes = Some(if sign == '-' { -total } else { total });
        }
        _ => {}
    }

    if !cursor.at_end() {
        return IsoOutcome::Refused;
    }
    day.iso = true;
    IsoOutcome::Complete
}

impl Cursor<'_> {
    /// The digits of the numeral at `index`, as written. Needed only for
    /// a fractional second, where the digits matter positionally and the
    /// numeral's value does not.
    fn digits_at(&self, index: usize) -> String {
        match self.tokens.get(index) {
            Some(Token::Number { value, width }) => {
                let text = value.to_string();
                // Restore the leading zeros the numeral dropped: `.05`
                // is fifty milliseconds, not five hundred.
                format!("{}{text}", "0".repeat(width.saturating_sub(text.len())))
            }
            _ => String::new(),
        }
    }
}

// --- the legacy parser -----------------------------------------------------

fn parse_legacy(
    cursor: &mut Cursor,
    day: &mut DayComposer,
    time: &mut TimeComposer,
    zone: &mut ZoneComposer,
) -> Option<()> {
    let mut read_number = !day.is_empty();

    while let Some(token) = cursor.next() {
        match token {
            Token::Number { value, .. } => {
                read_number = true;
                if cursor.skip_symbol(':') {
                    if cursor.skip_symbol(':') {
                        // "n::" — an hour with the minutes elided.
                        if !time.is_empty() {
                            return None;
                        }
                        time.push(value);
                        time.push(0);
                    } else {
                        time.push(value);
                        if cursor.peek() == Some(Token::Symbol('.')) {
                            cursor.next();
                        }
                    }
                } else if cursor.skip_symbol('.') && time.expecting(value) {
                    time.push(value);
                    let Some(Token::Number { .. }) = cursor.peek() else {
                        return None;
                    };
                    let text = cursor.digits_at(cursor.index);
                    cursor.next();
                    let mut millis = 0;
                    for position in 0..3 {
                        let digit = text
                            .as_bytes()
                            .get(position)
                            .map_or(0, |byte| i64::from(byte.saturating_sub(b'0')).clamp(0, 9));
                        millis = millis * 10 + digit;
                    }
                    time.push_final(millis);
                } else if zone.expecting(value) {
                    zone.minute = Some(value);
                } else if time.expecting(value) {
                    time.push_final(value);
                    // What follows a final time component may only be
                    // nothing, a space, `z`, or a sign.
                    match cursor.peek() {
                        None
                        | Some(
                            Token::Whitespace
                            | Token::Keyword(Keyword::Zone(0))
                            | Token::Symbol('+' | '-'),
                        ) => {}
                        _ => return None,
                    }
                } else {
                    day.push(value);
                    cursor.skip_symbol('-');
                }
            }
            Token::Keyword(word) => match word {
                Keyword::Meridiem(offset) if !time.is_empty() => time.meridiem = Some(offset),
                Keyword::Month(month) => {
                    day.named_month = Some(month);
                    cursor.skip_symbol('-');
                }
                Keyword::Zone(hours) => zone.set(hours),
                // A garbage word — and a time separator or a meridiem
                // in a position that is not one — is legal only before
                // the first number, and must be separated from it.
                _ => {
                    if read_number {
                        return None;
                    }
                    if matches!(cursor.peek(), Some(Token::Number { .. })) {
                        return None;
                    }
                }
            },
            Token::Symbol(sign @ ('+' | '-')) if zone.is_utc() || !time.is_empty() => {
                zone.sign = Some(if sign == '-' { -1 } else { 1 });
                let mut value = 0;
                let mut width = 0;
                if let Some(Token::Number {
                    value: number,
                    width: digits,
                }) = cursor.peek()
                {
                    cursor.index += 1;
                    value = number;
                    width = digits;
                }
                read_number = true;

                if matches!(cursor.peek(), Some(Token::Symbol(':'))) {
                    zone.hour = Some(value);
                    zone.minute = None;
                } else if width == 1 || width == 2 {
                    // `GMT-8` and `+05`.
                    zone.hour = Some(value);
                    zone.minute = Some(0);
                } else if width == 3 || width == 4 {
                    // `+0530`, where the numeral is 530 across four
                    // characters.
                    zone.hour = Some(value / 100);
                    zone.minute = Some(value % 100);
                } else {
                    return None;
                }
            }
            Token::Symbol('+' | '-' | ')') if read_number => return None,
            // Everything else — separators, whitespace, the text of a
            // parenthesised comment — is ignored.
            _ => {}
        }
    }
    Some(())
}

// --- composers -------------------------------------------------------------

#[derive(Debug, Default)]
struct DayComposer {
    parts: Vec<i64>,
    named_month: Option<i64>,
    /// Set only by a complete ISO parse, and it changes two things: the
    /// order is year-month-day rather than guessed, and a two-digit year
    /// is taken literally instead of being mapped into a century.
    iso: bool,
}

impl DayComposer {
    fn push(&mut self, value: i64) {
        if self.parts.len() < 3 {
            self.parts.push(value);
        }
    }

    fn is_empty(&self) -> bool {
        self.parts.is_empty()
    }

    /// Year, month (1-based) and day, or `None` if the parts cannot be
    /// one.
    fn write(&self) -> Option<(i64, i64, i64)> {
        if self.parts.is_empty() {
            return None;
        }
        let mut parts = self.parts.clone();
        // A missing month or day is the first of it.
        while parts.len() < 3 {
            parts.push(1);
        }

        let is_day = |value: i64| (1..=31).contains(&value);
        let (mut year, month, day) = match self.named_month {
            None => {
                if self.iso || !is_day(parts[0]) {
                    (parts[0], parts[1], parts[2])
                } else {
                    // Month first — US ordering, which is why
                    // `15/1/2024` is a refusal rather than 15 January.
                    (parts[2], parts[0], parts[1])
                }
            }
            // With the month named, the only question is which of the
            // two remaining numbers is the day — and a number that
            // cannot be a day must be the year. `January 2024` reaches
            // here with one part and takes the default day of 1.
            Some(named) => {
                if is_day(parts[0]) {
                    (parts[1], named, parts[0])
                } else {
                    (parts[0], named, parts[1])
                }
            }
        };

        if !self.iso {
            if (0..=49).contains(&year) {
                year += 2000;
            } else if (50..=99).contains(&year) {
                year += 1900;
            }
        }

        ((1..=12).contains(&month) && is_day(day)).then_some((year, month, day))
    }
}

#[derive(Debug, Default)]
struct TimeComposer {
    parts: Vec<i64>,
    meridiem: Option<i64>,
}

impl TimeComposer {
    fn push(&mut self, value: i64) {
        if self.parts.len() < 4 {
            self.parts.push(value);
        }
    }

    /// Add a component and close the time, so nothing later can extend it.
    fn push_final(&mut self, value: i64) {
        self.push(value);
        while self.parts.len() < 4 {
            self.parts.push(0);
        }
    }

    fn is_empty(&self) -> bool {
        self.parts.is_empty()
    }

    /// Whether this number could be the next component. It is what
    /// decides that the `30` in `+05:30` is a zone and the `30` in
    /// `10:30` is a minute.
    fn expecting(&self, value: i64) -> bool {
        match self.parts.len() {
            1 | 2 => (0..=59).contains(&value),
            3 => (0..=999).contains(&value),
            _ => false,
        }
    }

    fn write(&self) -> Option<(i64, i64, i64, i64)> {
        let mut parts = self.parts.clone();
        while parts.len() < 4 {
            parts.push(0);
        }
        if let Some(offset) = self.meridiem {
            // Twelve-hour time, so the hour has to be one: `13:30 PM`
            // is a refusal, and `12:30 AM` is half past midnight.
            if !(0..=12).contains(&parts[0]) {
                return None;
            }
            parts[0] = parts[0] % 12 + offset;
        }
        let in_range = (0..=23).contains(&parts[0])
            && (0..=59).contains(&parts[1])
            && (0..=59).contains(&parts[2])
            && (0..=999).contains(&parts[3]);
        // A twenty-fourth hour is allowed, but only exactly on the hour.
        let midnight_tomorrow = parts == [24, 0, 0, 0];
        if !in_range && !midnight_tomorrow {
            return None;
        }
        Some((parts[0], parts[1], parts[2], parts[3]))
    }
}

/// What a string said about its timezone. `Local` is not a default and
/// not a zero — it is the string having said nothing, which resolves
/// against the machine and is the reason two people can read the same
/// file and get different instants.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Offset {
    Local,
    Minutes(i64),
}

#[derive(Debug, Default)]
struct ZoneComposer {
    sign: Option<i64>,
    hour: Option<i64>,
    minute: Option<i64>,
    /// An offset the ISO parser resolved outright, in minutes.
    minutes: Option<i64>,
}

impl ZoneComposer {
    /// A named zone, in whole hours east of UTC.
    fn set(&mut self, hours: i64) {
        self.sign = Some(1);
        self.hour = Some(hours);
        self.minute = Some(0);
    }

    fn is_utc(&self) -> bool {
        self.hour == Some(0) && self.minute == Some(0)
    }

    fn expecting(&self, value: i64) -> bool {
        self.hour.is_some() && self.minute.is_none() && (0..=59).contains(&value)
    }

    /// The offset the string carried, or `None` if the components are
    /// out of range.
    fn write(&self) -> Option<Offset> {
        if let Some(minutes) = self.minutes {
            return Some(Offset::Minutes(minutes));
        }
        let Some(sign) = self.sign else {
            return Some(Offset::Local);
        };
        let hour = self.hour.unwrap_or(0);
        let minute = self.minute.unwrap_or(0);
        if !(-24..=24).contains(&hour) || !(-59..=59).contains(&minute) {
            return None;
        }
        Some(Offset::Minutes(sign * (hour * 60 + minute)))
    }
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::*;

    #[derive(Debug, Deserialize)]
    struct Oracle {
        timezone: String,
        cases: Vec<Case>,
    }

    #[derive(Debug, Deserialize)]
    struct Case {
        input: String,
        why: String,
        timestamp: Option<i64>,
    }

    /// The whole of this module's contract, taken from V8 itself.
    ///
    /// Four of the shapes carry no timezone, so their instant is a
    /// property of the machine; the corpus records which one it was
    /// taken on and this refuses to pretend otherwise.
    #[test]
    fn every_case_answers_what_v8_answers() {
        let oracle: Oracle = serde_json::from_str(include_str!("../../fixtures/date-parse.json"))
            .expect("the oracle is valid JSON");

        let zone = std::env::var("TZ").unwrap_or_default();
        assert_eq!(
            zone, oracle.timezone,
            "run with TZ={} — this corpus is not meaningful in another zone",
            oracle.timezone
        );

        let mut wrong = Vec::new();
        for case in &oracle.cases {
            let actual = date_parse(&case.input);
            if actual != case.timestamp {
                wrong.push(format!(
                    "  {:?} ({}): V8 says {:?}, this says {:?}",
                    case.input, case.why, case.timestamp, actual
                ));
            }
        }
        assert!(
            wrong.is_empty(),
            "{} of {} cases disagree with V8:\n{}",
            wrong.len(),
            oracle.cases.len(),
            wrong.join("\n")
        );
    }

    #[test]
    fn a_word_matches_a_month_on_its_first_three_letters() {
        assert_eq!(keyword("Janxxx"), Keyword::Month(1));
        assert_eq!(keyword("JANUARY"), Keyword::Month(1));
        assert_eq!(keyword("Ja"), Keyword::Unknown);
    }

    /// A short entry matches only a word of exactly its length, which is
    /// what keeps `z` a zone and `zz` a garbage word.
    #[test]
    fn a_short_keyword_does_not_match_a_longer_word() {
        assert_eq!(keyword("z"), Keyword::Zone(0));
        assert_eq!(keyword("zz"), Keyword::Unknown);
        assert_eq!(keyword("t"), Keyword::TimeSeparator);
    }

    #[test]
    fn a_numeral_keeps_its_width_as_written() {
        let tokens = tokenize("0800");
        assert_eq!(
            tokens,
            [Token::Number {
                value: 800,
                width: 4
            }]
        );
    }

    #[test]
    fn a_numeral_past_nine_digits_keeps_only_the_first_nine() {
        let tokens = tokenize("12345678901234");
        assert_eq!(
            tokens,
            [Token::Number {
                value: 123_456_789,
                width: 14
            }]
        );
    }
}
