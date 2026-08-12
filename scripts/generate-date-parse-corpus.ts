/**
 * Regenerate `crate/fixtures/date-parse.json` — the V8 oracle.
 *
 * The crate reimplements `Date.parse`, so "is the reimplementation
 * right" has exactly one authority: what V8 answers. This script asks
 * it, over every shape the extraction patterns can produce plus the
 * edges that decide the legacy parser's rules, and writes the answers
 * down. The crate replays the file; a disagreement fails its build.
 *
 * `TZ` is pinned because four of the six shapes carry no timezone and
 * their instant is therefore a property of the machine. A zone with DST
 * is the only kind that can catch a wrong conversion, so a zone with
 * DST is the one pinned.
 *
 *   TZ=America/New_York bun scripts/generate-date-parse-corpus.ts
 *
 * Adding a case is the point. Removing one needs a reason in the
 * CHANGELOG, because every case here is a rule someone relied on.
 */

const TIMEZONE = 'America/New_York';

interface Case {
	readonly input: string;
	readonly why: string;
	timestamp?: number | null;
}

/** Every shape the anchored extraction patterns can hand to Date.parse. */
const SHAPES: Case[] = [
	// --- the Date Time String Format (ECMA-262 §21.4.1.32) ---
	{ input: '2024-01-15T10:30:45Z', why: 'iso, zulu' },
	{ input: '2024-01-15T10:30:45.123Z', why: 'iso, millis' },
	{ input: '2024-01-15T10:30:45', why: 'iso, no zone — local' },
	{ input: '2024-01-15T10:30:45.123', why: 'iso, millis, no zone' },
	{ input: '2024-01-15T10:30:45+05:30', why: 'iso, positive offset' },
	{ input: '2024-01-15T10:30:45+05:00', why: 'the offset a basic-format +05 is padded into' },
	{ input: '2024-01-15T10:30:45-08:00', why: 'iso, negative offset' },
	{ input: '2024-01-15T10:30:45+00:00', why: 'iso, zero offset' },
	{ input: '2024-01-15T00:00:00Z', why: 'iso, midnight' },
	{ input: '2024-01-15T24:00:00Z', why: 'hour 24 is the next midnight' },
	{ input: '2024-01-15T10:60:00Z', why: 'minute 60 is a refusal' },
	{ input: '2024-01-15T10:30:60Z', why: 'second 60 is a refusal' },
	{ input: '2024-02-30T00:00:00Z', why: 'day 30 of February rolls over' },
	{ input: '2023-02-29T00:00:00Z', why: 'a leap day in a common year rolls over' },
	{ input: '2024-13-01T00:00:00Z', why: 'month 13 is a refusal' },
	{ input: '2024-00-01T00:00:00Z', why: 'month 0 is a refusal' },
	{ input: '2024-01-32T00:00:00Z', why: 'day 32 is a refusal' },
	{ input: '2024-01-00T00:00:00Z', why: 'day 0 is a refusal' },
	{ input: '2024-01-15T10:30:45+24:00', why: 'a 24-hour offset is a refusal' },
	{ input: '1970-01-01T00:00:00Z', why: 'the epoch' },
	{ input: '1969-12-31T23:59:59Z', why: 'before the epoch' },
	{ input: '2024-01-15T10:30:45.1Z', why: 'one fractional digit' },
	{ input: '2024-01-15T10:30:45.123456Z', why: 'fraction past millis truncates' },
	// --- date-only: UTC, not local. The distinction the whole tool rests on ---
	{ input: '2024-01-15', why: 'simple, and UTC where the datetime form is local' },
	{ input: '2024-02-29', why: 'a real leap day' },
	{ input: '2023-02-29', why: 'a fake leap day rolls over' },
	{ input: '2024-12-31', why: 'year end' },
	{ input: '2024-00-10', why: 'month 0 is a refusal' },
	{ input: '2024-01-00', why: 'day 0 is a refusal' },
	// --- RFC 2822, as the anchored pattern can produce it ---
	{ input: 'Mon, 15 Jan 2024 10:30:45 GMT', why: 'rfc2822' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 UTC', why: 'utc names the same offset' },
	{ input: 'Fri, 15 Jan 2024 10:30:45 GMT', why: 'the weekday is wrong and ignored' },
	{ input: 'Xyz, 15 Jan 2024 10:30:45 GMT', why: 'the weekday is not a word and is ignored' },
	{ input: 'Mon, 15 Xxx 2024 10:30:45 GMT', why: 'the month is not a word — a refusal' },
	{ input: 'Mon, 1 Jan 2024 00:00:00 GMT', why: 'a one-digit day' },
	// the eight fixed US offsets, and the abbreviations that are not words
	{ input: 'Mon, 15 Jan 2024 10:30:45 EST', why: 'EST is always -5, never zone-aware' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 EDT', why: 'EDT is always -4' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 CST', why: 'CST is always -6' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 CDT', why: 'CDT is always -5' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 MST', why: 'MST is always -7' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 MDT', why: 'MDT is always -6' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 PST', why: 'PST is always -8' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 PDT', why: 'PDT is always -7' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 CEST', why: 'CEST is not a word — a refusal' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 CET', why: 'nor CET' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 BST', why: 'nor BST' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 JST', why: 'JST is not a word — a refusal' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 AEST', why: 'AEST is not a word — a refusal' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 IST', why: 'nor IST, which stands for three different zones' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 XYZ', why: 'nonsense is a refusal' },
	// The numeric offsets extraction rewrites those abbreviations into
	// before handing the string back to this parser.
	{ input: 'Mon, 15 Jan 2024 10:30:45 +0100', why: 'the offset CET is rewritten to' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 +0200', why: 'and CEST' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 +0900', why: 'and JST' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 +1000', why: 'and AEST' },
	{ input: 'Mon, 15 Jan 2024 10:30:45 +0530', why: 'and IST' },
	// --- the toString form ---
	{ input: 'Mon Jan 15 2024 10:30:45 GMT+0000', why: 'utc form' },
	{ input: 'Mon Jan 15 2024 10:30:45 GMT-0800', why: 'utc form, negative' },
	{ input: 'Xyz Jan 15 2024 10:30:45 GMT+0530', why: 'the weekday is ignored here too' },
	{
		input: 'Mon Jan 15 2024 10:30:45 GMT+0000 (Coordinated Universal Time)',
		why: 'the trailing comment is skipped',
	},
	// --- M/D/YYYY, US ordering, a documented limitation of the tool ---
	{ input: '1/15/2024 10:30:45', why: 'local, US ordering' },
	{ input: '12/31/2024 23:59:59', why: 'local, year end' },
	{ input: '15/1/2024 10:30:45', why: 'D/M ordering is a refusal, not a reinterpretation' },
	{ input: '13/1/2024 10:30:45', why: 'month 13 is a refusal' },
	{ input: '2/30/2024 1:2:3', why: 'February 30 rolls over here too' },
	{ input: '1/15/2024 25:30:45', why: 'hour 25 is a refusal' },
	// --- log timestamps: the same instant as the T form ---
	{ input: '2024-01-15 10:30:45', why: 'a space where the T goes' },
	{ input: '2024-01-15 10:30:45.123', why: 'with millis' },
	// --- syslog, once the year has been appended ---
	{ input: 'Jan 15 10:30:45 2026', why: 'syslog, year appended' },
	{ input: 'Feb  5 09:01:02 2026', why: 'syslog pads the day with a second space' },
	{ input: 'Dec 31 23:59:59 2026', why: 'syslog, year end' },
	{ input: 'Xxx 15 10:30:45 2026', why: 'not a month — a refusal' },
	// --- Apache, once normalised out of its brackets ---
	{ input: '15 Jan 2024 10:30:08 +0000', why: 'apache, normalised' },
	{ input: '15 Jan 2024 10:30:08 -0500', why: 'apache, negative offset' },
	{ input: '15 Jan 2024 10:30:08 +0530', why: 'apache, half-hour offset' },
];

/**
 * The unbounded case: a quoted string inside `new Date(...)` or a
 * `datetime=` attribute is whatever someone wrote. These are the rules
 * that decide what the legacy parser accepts, each one probed rather
 * than assumed.
 */
const LEGACY: Case[] = [
	{ input: 'March 5, 2024', why: 'the month written out' },
	{ input: 'March 5 2024', why: 'no comma' },
	{ input: '5 March 2024', why: 'day first' },
	{ input: '2024 March 5', why: 'year first' },
	{ input: 'Mar 5, 2024', why: 'abbreviated' },
	{ input: 'Janu 15 2024', why: 'four letters — matched on the first three' },
	{ input: 'Januar 15 2024', why: 'six letters' },
	{ input: 'January 15 2024', why: 'all of it' },
	{ input: 'Janxxx 15 2024', why: 'three right letters and nonsense after' },
	{ input: 'Ja 15 2024', why: 'two letters is not enough — a refusal' },
	{ input: 'JANUARY 15 2024', why: 'case does not matter' },
	{ input: 'january 15 2024', why: 'nor here' },
	{ input: 'Foo Jan 15 2024', why: 'a garbage word before the first number is skipped' },
	{ input: 'Foo Bar Jan 15 2024', why: 'two of them' },
	{ input: 'Jan 15 2024 Foo', why: 'a garbage word after a number is fatal' },
	// V8 scans a word while the character is `A` or above, so anything
	// outside ASCII is INSIDE the word rather than beside it — and the
	// keyword still matches on the first three characters of it. The
	// crate read words with Rust's `is_alphabetic` and matched on the
	// first three BYTES, which disagreed with every case below and
	// aborted the process on two of them.
	{ input: 'Jané 15 2024', why: 'an accent joins the word, and jan still matches' },
	{ input: 'Jané15 2024', why: 'and it does not separate the word from the number' },
	{ input: 'Jaé 15 2024', why: 'two letters and an accent is not a month' },
	{ input: 'JANUARYé 15 2024', why: 'the accent is past the prefix' },
	{ input: 'café 15 2024', why: 'a word of letters and an accent is garbage' },
	{ input: 'é 15 2024', why: 'a lone accent is a word, so 15 and 2024 have no month' },
	{ input: 'é Jan 15 2024', why: 'and before a month it is garbage that is skipped' },
	{ input: 'Jan 15 2024 é', why: 'after the first number it is fatal like any word' },
	{
		input: 'Jan\u{a0}15 2024',
		why: 'a non-breaking space is a word character, not a space',
	},
	{
		input: 'Jan 15 2024\u{a0}',
		why: 'so a trailing one is a garbage word, and fatal',
	},
	{ input: 'Jan 15 2024\u{3000}', why: 'an ideographic space is the same' },
	{ input: 'Jan 15 2024\u{feff}', why: 'and so is a byte-order mark' },
	{
		input: '\u{feff}Jan 15 2024',
		why: 'a leading one joins the month and breaks it',
	},
	{
		input: 'Jan 15 2024\u{01}',
		why: 'a control character is below A, so it is neither a word nor fatal',
	},
	{ input: 'Jan 15 2024@', why: 'nor is a symbol below A' },
	{
		input: 'Jan 15 2024_',
		why: 'an underscore is above A, so it is a word and is fatal',
	},
	{ input: '\u{1f5d3} Jan 15 2024', why: 'an astral character is a word, and garbage' },
	// Two characters whose lowercase is a different LENGTH: U+0130 grows
	// to two code points and U+212A shrinks to one byte. V8 lowercases
	// with `c | 0x20`, which changes neither, so the keyword prefix is
	// still three characters of the word as written. Taking them from a
	// `to_lowercase` copy would slide, and a slide that lands mid
	// character aborts the process — the shape that crashed a sibling.
	{
		input: '\u{130}Jan 15 2024',
		why: 'a dotted capital I joins the month and breaks the prefix',
	},
	{ input: 'Jan\u{130} 15 2024', why: 'past the prefix it changes nothing' },
	{ input: '\u{130} Jan 15 2024', why: 'and alone it is a garbage word' },
	{
		input: '\u{212a}Jan 15 2024',
		why: 'a kelvin sign is the same, and lowercases shorter',
	},
	{ input: '\u{212a}an 15 2024', why: 'and is not the letter k for this' },
	{ input: 'Jan 15 2024\u{212a}', why: 'trailing, it is a word and is fatal' },
	{ input: 'Ja\u{1f5d3} 15 2024', why: 'joined to two letters it is still not a month' },
	{ input: 'Jan 15 2024 (a comment)', why: 'parenthesised text is a comment' },
	{ input: 'Jan 15 2024 (unclosed', why: 'an unclosed comment is still a comment' },
	{ input: 'Jan 32 2024', why: 'day 32 is a refusal' },
	{ input: 'Jan 0 2024', why: 'day 0 is a refusal' },
	{ input: '1 2 2024', why: 'three bare numbers, US ordering' },
	{ input: '2024 1 2', why: 'year first when it cannot be a month' },
	{ input: '1-2-2024', why: 'dashes' },
	{ input: '2024-1-2', why: 'unpadded — not the ISO grammar, so the legacy parser takes it' },
	{ input: '2024/01/15', why: 'slashes, year first' },
	{ input: '01/15/2024', why: 'slashes, US ordering' },
	{ input: '2024.01.15', why: 'dots' },
	{ input: '15.01.2024', why: 'dots, day first — a refusal' },
	{ input: 'Jan 15 2024 10:30', why: 'hours and minutes only' },
	{ input: 'Jan 15 2024 10:30:45.5', why: 'a fractional second' },
	{ input: 'Jan 15 2024 1:30 PM', why: 'pm shifts by twelve' },
	{ input: 'Jan 15 2024 1:30 pm', why: 'lowercase' },
	{ input: 'Jan 15 2024 12:30 AM', why: 'twelve am is midnight' },
	{ input: 'Jan 15 2024 12:30 PM', why: 'twelve pm is noon' },
	{ input: 'Jan 15 2024 13:30 PM', why: 'pm past twelve is a refusal' },
	{ input: 'Jan 15 2024 10:30:45 UT', why: 'UT is an offset of zero' },
	{ input: 'Jan 15 2024 10:30:45 Z', why: 'so is Z' },
	{ input: 'Jan 15 2024 10:30:45 +05:30', why: 'a bare offset with a colon' },
	{ input: 'Jan 15 2024 10:30:45 +0530', why: 'and without' },
	{ input: 'Jan 15 2024 10:30:45 +05', why: 'hours only' },
	{ input: 'Jan 15 2024 10:30:45 GMT+5', why: 'a single-digit offset' },
	{ input: 'Jan 15 2024 10:30:45 GMT+05:30', why: 'GMT with a colon offset' },
	{ input: '1/15/99 10:30:45', why: 'a two-digit year, 50 and up, is 1900s' },
	{ input: '1/15/50 10:30:45', why: 'the boundary, below' },
	{ input: '1/15/49 10:30:45', why: 'the boundary, above' },
	{ input: '1/15/24 10:30:45', why: 'under 50 is 2000s' },
	{ input: '1/15/00 10:30:45', why: 'and zero' },
	{ input: 'Tue Mar 05 2024', why: 'a date with no time at all' },
	{ input: 'Mon, 15 Jan 2024', why: 'rfc2822 without the time' },
	{ input: '2024', why: 'a bare year is the ISO grammar, so UTC' },
	{ input: '2024-01', why: 'a year and month, also UTC' },
	{ input: 'January 2024', why: 'the same month by name is legacy, so local' },
	{ input: '2024-001', why: 'not an ordinal date — read as a year and a number' },
	{ input: 'not a date', why: 'a refusal' },
	{ input: '', why: 'the empty string is a refusal' },
	{ input: 'now', why: 'not a thing V8 knows' },
	// The ISO 8601 shapes V8 has no rule for. Extraction resolves these
	// itself, above this parser, and normalises each into a form that
	// appears elsewhere in this file — so the divergence is one string
	// rewrite rather than a second calendar.
	{ input: '2024-W03', why: 'week dates are not supported' },
	{ input: '2024-W03-1', why: 'nor with a day of the week' },
	{ input: '2024-015', why: 'an ordinal date is a refusal once the number cannot be a month' },
	{ input: '2024-060', why: 'and another' },
	{ input: '20240115', why: 'basic-format ISO is not supported' },
	{ input: '20240115T103045Z', why: 'nor the basic date-time form' },
	{ input: '20240115T103045', why: 'nor without a zone' },
	{ input: '10:30:45', why: 'a time with no date is a refusal' },
	{ input: 'T10:30:45', why: 'nor with a T' },
	{ input: '2024-01-15T10:30', why: 'minutes without seconds' },
	{ input: '2024-01-15 10:30', why: 'the same with a space' },
	{ input: '2024-01-15t10:30:45z', why: 'lowercase t and z' },
	// A two-digit year means different things to the two parsers: the ISO
	// grammar takes it literally, the legacy one maps it into 1900s/2000s.
	// Which parser saw the string therefore has to be decided correctly,
	// not merely fallen into.
	{ input: '0024-01-15', why: 'a four-digit ISO year of 24 is the year 24' },
	{ input: '0099-12-31T00:00:00Z', why: 'and 99 is the year 99' },
	{ input: '0024-1-15', why: 'the same year unpadded is legacy, and becomes 2024' },
	// The ISO grammar matching a prefix, with the rest left to legacy.
	{ input: '2024-01-15T10:30:45 GMT', why: 'an ISO prefix and a legacy zone' },
	{ input: '2024-01-15T10:30:45Z extra', why: 'trailing garbage after a complete ISO string' },
	{ input: '2024-01-15T10:30:45+05:30 (India)', why: 'a comment after a complete one' },
];

/**
 * Local time is a property of the machine, and the two hours a year
 * where it is not a function at all are the only ones that can catch a
 * wrong conversion. Pinned in a zone that has them.
 */
const DST: Case[] = [
	{ input: '2024-03-10 01:59:59', why: 'the last second before the gap' },
	{ input: '2024-03-10 02:30:00', why: 'inside the gap — an hour that does not exist' },
	{ input: '2024-03-10 03:00:00', why: 'the first second after the gap' },
	{ input: '2024-11-03 00:30:00', why: 'before the fold' },
	{ input: '2024-11-03 01:30:00', why: 'inside the fold — an hour that happens twice' },
	{ input: '2024-11-03 02:30:00', why: 'after the fold' },
	{ input: '2024-03-10T02:30:00Z', why: 'the same instant with a zone is unaffected' },
];

function main(): void {
	if (process.env.TZ !== TIMEZONE) {
		console.error(
			`This corpus is only meaningful under TZ=${TIMEZONE} — four of the six\n` +
				`shapes have no timezone, so their instant is a property of the machine.\n\n` +
				`  TZ=${TIMEZONE} bun scripts/generate-date-parse-corpus.ts`,
		);
		process.exit(2);
	}

	const groups = [
		['shapes the extraction patterns produce', SHAPES],
		['the legacy parser, which no standard describes', LEGACY],
		['daylight saving, where local time is not a function', DST],
	] as const;

	const cases = groups.flatMap(([, group]) =>
		group.map((entry) => {
			const parsed = Date.parse(entry.input);
			return {
				input: entry.input,
				why: entry.why,
				timestamp: Number.isNaN(parsed) ? null : parsed,
			};
		}),
	);

	const duplicates = cases
		.map((entry) => entry.input)
		.filter((input, index, all) => all.indexOf(input) !== index);
	if (duplicates.length > 0) {
		console.error(`duplicate inputs: ${duplicates.join(', ')}`);
		process.exit(2);
	}

	const document = {
		$comment:
			'Generated by scripts/generate-date-parse-corpus.ts — V8 is the ' +
			'authority for what Date.parse returns, and the crate reimplements ' +
			'it. Do not hand-edit; regenerate.',
		timezone: TIMEZONE,
		cases,
	};

	const path = new URL('../crate/fixtures/date-parse.json', import.meta.url);
	Bun.write(path, `${JSON.stringify(document, null, '\t')}\n`);

	const refused = cases.filter((entry) => entry.timestamp === null).length;
	console.log(
		`${cases.length} cases (${refused} refusals) → crate/fixtures/date-parse.json`,
	);
}

main();
