/**
 * Regional notations: numeric dates with the day or the month first, and
 * dates that spell the month out.
 *
 * These are resolved here rather than by `Date.parse`, which reads only
 * month-first slashes, refuses `15/01/2024` outright and knows nothing of
 * `15.01.2024`. The crate's `regional.rs` is the same code; the shared
 * corpus holds the two equal.
 *
 * **The order is read from the value when the value says it.** A first
 * number over 12 can only be a day, a second number over 12 can only be a
 * day, so `15/01/2024` and `1/15/2024` each resolve one way whatever the
 * setting. Only when both numbers fit a month is the order a choice, and
 * then it is the caller's `DateOrder` — except for dots, which no
 * convention writes month-first.
 *
 * Every value is checked as a calendar date. `31/02/2024` is refused
 * rather than rolled into March, and a numeric year outside 1900–2099 is
 * refused, which keeps version strings such as `1.2.3000` out.
 */

export type DateOrder = 'mdy' | 'dmy';

export const DEFAULT_DATE_ORDER: DateOrder = 'mdy';

export function isDateOrder(value: unknown): value is DateOrder {
	return value === 'mdy' || value === 'dmy';
}

const NUMERIC =
	/^(\d{1,2})([/.-])(\d{1,2})[/.-](\d{4})(?:\s(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([AaPp])[Mm])?)?$/;

const MONTHS = [
	'jan',
	'feb',
	'mar',
	'apr',
	'may',
	'jun',
	'jul',
	'aug',
	'sep',
	'oct',
	'nov',
	'dec',
] as const;

/** A numeric date, in either order; NaN when it is not a real one. */
export function numericDate(value: string, order: DateOrder): number {
	const match = NUMERIC.exec(value);
	if (!match) return Number.NaN;
	const [, rawFirst, separator, rawSecond, rawYear] = match;
	const first = Number(rawFirst);
	const second = Number(rawSecond);
	const year = Number(rawYear);
	if (year < 1900 || year > 2099) return Number.NaN;

	const dayFirst =
		first > 12 || (second <= 12 && (separator === '.' || order === 'dmy'));
	const [day, month] = dayFirst ? [first, second] : [second, first];

	const time = clock(match[5], match[6], match[7], match[8]);
	if (!time) return Number.NaN;
	return localInstant(year, month, day, time);
}

/**
 * A date with its month written out: `15 Jan 2024`, `15th January, 2024`,
 * `15-Jan-2024`, `Jan 15, 2024`, `January 15th 2024`.
 */
export function writtenDate(value: string): number {
	const year = Number(value.slice(-4));
	const day = Number(/\d{1,2}/.exec(value)?.[0]);
	const word = /[A-Za-z]{3}/.exec(value.replace(/\d+(?:st|nd|rd|th)/gi, ''));
	const month = MONTHS.indexOf(
		(word?.[0].toLowerCase() ?? '') as (typeof MONTHS)[number],
	);
	if (month === -1 || year < 1000) return Number.NaN;
	return localInstant(year, month + 1, day, [0, 0, 0]);
}

type Clock = readonly [hour: number, minute: number, second: number];

function clock(
	hour: string | undefined,
	minute: string | undefined,
	second: string | undefined,
	meridiem: string | undefined,
): Clock | undefined {
	if (hour === undefined) return [0, 0, 0];
	let h = Number(hour);
	const m = Number(minute);
	const s = Number(second ?? '0');
	if (meridiem !== undefined) {
		if (h < 1 || h > 12) return undefined;
		const pm = meridiem.toLowerCase() === 'p';
		h = (h % 12) + (pm ? 12 : 0);
	}
	if (h > 23 || m > 59 || s > 59) return undefined;
	return [h, m, s];
}

function localInstant(
	year: number,
	month: number,
	day: number,
	[hour, minute, second]: Clock,
): number {
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
		return Number.NaN;
	}
	return new Date(year, month - 1, day, hour, minute, second).getTime();
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) {
		const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
		return leap ? 29 : 28;
	}
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
