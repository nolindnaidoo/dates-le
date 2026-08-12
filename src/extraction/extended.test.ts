import { describe, expect, it } from 'vitest';
import {
	isoBasicFormat,
	isoOrdinalDate,
	isoWeekDate,
	resolveInstant,
} from './extended';

/**
 * The mirror of `crate/src/extract/extended.rs`. Every case here is one
 * V8 answers NaN to, which is what makes this file a divergence rather
 * than an extension of the parser — and why the crate holds the same
 * cases.
 *
 * The suite runs under TZ=UTC (see package.json), and every instant
 * asserted here is a date-only one, which is UTC whatever the machine.
 */

/** `2024-01-15` as an instant: UTC midnight, because a date-only string is UTC. */
const JANUARY_FIFTEENTH = 1_705_276_800_000;

describe('ISO week dates', () => {
	it('is the Monday of that week', () => {
		// 2024 begins on a Monday, so week 1 begins on 1 January and week
		// 3 on the fifteenth.
		expect(isoWeekDate('2024-W03')).toBe(JANUARY_FIFTEENTH);
		expect(isoWeekDate('2024-W03-1')).toBe(JANUARY_FIFTEENTH);
	});

	it('moves with the day of the week', () => {
		expect(isoWeekDate('2024-W03-7') - isoWeekDate('2024-W03-1')).toBe(
			6 * 86_400_000,
		);
	});

	// Both directions a week can cross a year boundary, which is the only
	// reason this needs a calculation rather than a lookup.
	it('can begin in the previous year and end in the next', () => {
		expect(isoWeekDate('2015-W01-1')).toBe(Date.parse('2014-12-29'));
		expect(isoWeekDate('2020-W53-7')).toBe(Date.parse('2021-01-03'));
	});

	it('refuses a 53rd week the year does not have', () => {
		expect(isoWeekDate('2024-W53')).toBeNaN();
		expect(isoWeekDate('2020-W53')).not.toBeNaN();
	});

	it('refuses a week or a day outside its range', () => {
		for (const value of ['2024-W00', '2024-W99', '2024-W03-0', 'nonsense']) {
			expect(isoWeekDate(value)).toBeNaN();
		}
	});
});

describe('ISO ordinal dates', () => {
	it('counts days from the first', () => {
		expect(isoOrdinalDate('2024-015')).toBe(JANUARY_FIFTEENTH);
		expect(isoOrdinalDate('2024-001')).toBe(Date.parse('2024-01-01'));
	});

	// The leap year is the case a naive month table gets wrong.
	it('puts the sixtieth day either side of the leap day', () => {
		expect(isoOrdinalDate('2024-060')).toBe(Date.parse('2024-02-29'));
		expect(isoOrdinalDate('2023-060')).toBe(Date.parse('2023-03-01'));
	});

	it('refuses a day the year does not have', () => {
		expect(isoOrdinalDate('2023-366')).toBeNaN();
		expect(isoOrdinalDate('2024-366')).not.toBeNaN();
		expect(isoOrdinalDate('2024-000')).toBeNaN();
		expect(isoOrdinalDate('nonsense')).toBeNaN();
	});
});

describe('ISO basic format', () => {
	it('is the extended form of the same date', () => {
		expect(isoBasicFormat('20240115')).toBe(JANUARY_FIFTEENTH);
	});

	it('keeps every zone rule the extended form has', () => {
		for (const [basic, extended] of [
			['20240115T103045Z', '2024-01-15T10:30:45Z'],
			['20240115T103045', '2024-01-15T10:30:45'],
			['20240115T103045.123Z', '2024-01-15T10:30:45.123Z'],
			['20240115T103045+0530', '2024-01-15T10:30:45+05:30'],
			['20240115T103045-0800', '2024-01-15T10:30:45-08:00'],
			['20240115T103045+05', '2024-01-15T10:30:45+05:00'],
		]) {
			expect(isoBasicFormat(basic as string)).toBe(
				Date.parse(extended as string),
			);
		}
	});

	// Without the window every eight-digit identifier holding a legal
	// month and day would be a date.
	it('refuses an eight-digit run outside the plausible years', () => {
		expect(isoBasicFormat('98765432')).toBeNaN();
		expect(isoBasicFormat('18991231')).toBeNaN();
		expect(isoBasicFormat('19000101')).not.toBeNaN();
	});

	it('refuses a month or a day that cannot exist', () => {
		for (const value of ['20245601', '20240132', '20240100', '20241301']) {
			expect(isoBasicFormat(value)).toBeNaN();
		}
	});

	it('refuses a malformed string', () => {
		for (const value of ['2024', '20240115X103045', '20240115T1030']) {
			expect(isoBasicFormat(value)).toBeNaN();
		}
	});

	// The window applies to the bare form only: a date-time says what it is.
	it('does not apply the year window to the date-time form', () => {
		expect(isoBasicFormat('18991231T103045Z')).not.toBeNaN();
	});
});

describe('timezone abbreviations V8 refuses', () => {
	it('resolves each to its fixed offset', () => {
		for (const [abbreviation, offset] of [
			['CEST', '+0200'],
			['CET', '+0100'],
			['BST', '+0100'],
			['JST', '+0900'],
			['AEST', '+1000'],
			['IST', '+0530'],
		]) {
			expect(resolveInstant(`Mon, 15 Jan 2024 10:30:45 ${abbreviation}`)).toBe(
				Date.parse(`Mon, 15 Jan 2024 10:30:45 ${offset}`),
			);
		}
	});

	// V8 answers first, so this layer can only turn a refusal into a
	// value, never a value into a different one.
	it('leaves a string V8 reads alone', () => {
		const value = 'Mon, 15 Jan 2024 10:30:45 EST';
		expect(resolveInstant(value)).toBe(Date.parse(value));
	});

	// A keyword matches on three letters in V8, so a substring match here
	// would read HISTORY as India.
	it('does not read an abbreviation inside a longer word', () => {
		expect(resolveInstant('Mon, 15 Jan 2024 10:30:45 HISTORY')).toBeNaN();
	});

	it('is still a refusal when there is no zone word at all', () => {
		expect(resolveInstant('not a date')).toBeNaN();
	});
});
