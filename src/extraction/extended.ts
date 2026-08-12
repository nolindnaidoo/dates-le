/**
 * The date shapes `Date.parse` refuses, and what this extension answers
 * instead.
 *
 * Everything here is a deliberate divergence from V8: ISO 8601 week
 * dates, ordinal dates and the basic format are all NaN, as is every
 * timezone abbreviation outside the eight US ones V8 knows. All of them
 * appear in real files, which is the whole argument for reading them.
 *
 * **Nothing here computes an instant.** Each shape is normalised into a
 * string `Date.parse` does read and handed straight back to it — so a
 * week date is UTC for the same reason a bare `2024-01-15` is UTC, a
 * zone-less basic date-time stays local with the machine's
 * daylight-saving history, and the Rust CLI can hold the identical rule
 * without either side owning a second calendar. The crate's mirror is
 * `crate/src/extract/extended.rs`; `crate/fixtures/` is the contract.
 */

/**
 * The abbreviations V8 lacks, and the fixed offset each stands for.
 * Fixed, not zone-aware — the same rule V8 applies to the eight it does
 * know, where `EST` is -5 in July as much as in January.
 *
 * `IST` is three zones (India +05:30, Ireland +01:00, Israel +02:00) and
 * no text can say which. India is the one taken; it is a guess, and
 * SPEC.md names it as one.
 */
const NAMED_ZONES: ReadonlyArray<readonly [string, string]> = Object.freeze([
	['CEST', '+0200'],
	['AEST', '+1000'],
	['CET', '+0100'],
	['BST', '+0100'],
	['JST', '+0900'],
	['IST', '+0530'],
] as const);

/**
 * Resolve with `Date.parse`, and only then with the zone names it lacks.
 *
 * The order is the contract: V8 answers everything it can answer, so
 * this layer can only turn a refusal into a value, never a value into a
 * different one.
 */
export function resolveInstant(value: string): number {
	const parsed = Date.parse(value);
	if (!Number.isNaN(parsed)) return parsed;

	const rewritten = withNumericZone(value);
	return rewritten === null ? Number.NaN : Date.parse(rewritten);
}

/**
 * Rewrite the first known abbreviation into its numeric offset. Matched
 * as a whole word: V8 matches a keyword on its first three letters, and
 * doing the same here would read the `IST` in `HISTORY` as India.
 */
function withNumericZone(value: string): string | null {
	for (const match of value.matchAll(/[A-Za-z]+/g)) {
		const found = NAMED_ZONES.find(
			([name]) => name.toLowerCase() === match[0].toLowerCase(),
		);
		if (!found || match.index === undefined) continue;
		const end = match.index + match[0].length;
		return value.slice(0, match.index) + found[1] + value.slice(end);
	}
	return null;
}

/**
 * `2024-W03` or `2024-W03-1` → the calendar date it names.
 *
 * ISO 8601 defines week 1 as the one containing 4 January, so the whole
 * calculation hangs off which weekday that is. A week can begin in the
 * previous year and end in the next, and both happen: `2015-W01-1` is
 * 29 December 2014.
 */
export function isoWeekDate(value: string): number {
	const match = /^(\d{4})-W(\d{2})(?:-(\d))?$/.exec(value);
	if (!match?.[1] || !match[2]) return Number.NaN;

	const year = Number(match[1]);
	const week = Number(match[2]);
	const day = match[3] === undefined ? 1 : Number(match[3]);

	// A year has 52 weeks or 53, and asking for a 53rd it does not have
	// is a refusal rather than the first week of the next year — the
	// string named a week that does not exist.
	if (week < 1 || week > weeksInYear(year) || day < 1 || day > 7) {
		return Number.NaN;
	}

	const firstMonday = 5 - januaryFourthWeekday(year);
	return resolveOrdinal(year, firstMonday + (week - 1) * 7 + (day - 1));
}

/** `2024-015` → the fifteenth day of 2024. */
export function isoOrdinalDate(value: string): number {
	const match = /^(\d{4})-(\d{3})$/.exec(value);
	if (!match?.[1] || !match[2]) return Number.NaN;
	return resolveOrdinal(Number(match[1]), Number(match[2]), false);
}

/**
 * `20240115`, `20240115T103045Z` → the extended form of the same.
 *
 * The bare eight-digit form is the one shape here that cannot prove it
 * is a date — it and an eight-digit identifier are the same characters —
 * so it is held to a plausible year as well as a real month and day, the
 * way a ten-digit epoch is held to a plausible range. A date-time needs
 * no such window: a `T` between eight digits and six is evidence of its
 * own.
 */
export function isoBasicFormat(value: string): number {
	const match =
		/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}(?:\d{2})?)?)?$/.exec(
			value,
		);
	if (!match?.[1] || !match[2] || !match[3]) return Number.NaN;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > 31) return Number.NaN;

	const date = `${match[1]}-${match[2]}-${match[3]}`;
	if (match[4] === undefined) {
		// Wide enough for anything a codebase dates itself with, narrow
		// enough that most identifiers fall out: `12345678` is month 56
		// and never reaches here, but `98765432` would be a September in
		// the year 9876 without it.
		if (year < 1900 || year > 2099) return Number.NaN;
		return Date.parse(date);
	}

	const time = `${match[4]}:${match[5]}:${match[6]}${match[7] ?? ''}`;
	return Date.parse(`${date}T${time}${extendedZone(match[8])}`);
}

/** `Z`, `+0530`, `+05` or nothing → what the extended grammar wants. */
function extendedZone(zone: string | undefined): string {
	if (zone === undefined || zone === 'Z') return zone ?? '';
	const minutes = zone.length === 3 ? '00' : zone.slice(3);
	return `${zone.slice(0, 3)}:${minutes}`;
}

/**
 * A day of the year, allowed to fall either side of it, as an instant.
 * A week date arrives here with an ordinal outside its own year whenever
 * the week spans a year boundary, which is what makes week dates worth a
 * calculation rather than a lookup.
 */
function resolveOrdinal(year: number, ordinal: number, spill = true): number {
	let resolvedYear = year;
	let resolvedOrdinal = ordinal;
	if (spill && resolvedOrdinal < 1) {
		resolvedYear -= 1;
		resolvedOrdinal += daysInYear(resolvedYear);
	} else if (spill && resolvedOrdinal > daysInYear(resolvedYear)) {
		resolvedOrdinal -= daysInYear(resolvedYear);
		resolvedYear += 1;
	}

	const found = monthAndDay(resolvedYear, resolvedOrdinal);
	if (!found) return Number.NaN;
	const [month, day] = found;
	return Date.parse(`${pad(resolvedYear, 4)}-${pad(month, 2)}-${pad(day, 2)}`);
}

/** The month and day a day-of-year lands on, or null if the year has none. */
function monthAndDay(year: number, ordinal: number): [number, number] | null {
	if (ordinal < 1 || ordinal > daysInYear(year)) return null;
	const lengths = [
		31,
		isLeap(year) ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	];

	let remaining = ordinal;
	for (const [index, length] of lengths.entries()) {
		if (remaining <= length) return [index + 1, remaining];
		remaining -= length;
	}
	return null;
}

function pad(value: number, width: number): string {
	return String(value).padStart(width, '0');
}

function isLeap(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInYear(year: number): number {
	return isLeap(year) ? 366 : 365;
}

/**
 * The weekday of 31 December, Sunday 0 — the standard year-only
 * calculation, and the only calendar arithmetic a rewrite cannot supply.
 */
function lastDayOfYear(year: number): number {
	const days =
		year +
		Math.floor(year / 4) -
		Math.floor(year / 100) +
		Math.floor(year / 400);
	return ((days % 7) + 7) % 7;
}

/**
 * The ISO weekday of 4 January, Monday 1 … Sunday 7. ISO 8601 puts that
 * day in week 1 by definition, so it is where every week date is
 * measured from.
 */
function januaryFourthWeekday(year: number): number {
	return ((((lastDayOfYear(year - 1) + 3) % 7) + 7) % 7) + 1;
}

/**
 * 52, or 53 for a year beginning on a Thursday and for a leap year
 * beginning on a Wednesday.
 */
function weeksInYear(year: number): number {
	return lastDayOfYear(year) === 4 || lastDayOfYear(year - 1) === 3 ? 53 : 52;
}
