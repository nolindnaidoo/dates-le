import { describe, expect, it } from 'vitest';
import { scanDates } from './heuristics';

describe('scanDates', () => {
	it('classifies each base format', () => {
		const content = [
			'2024-01-15T10:30:00Z',
			'Mon, 15 Jan 2024 10:30:00 GMT',
			'1705312200',
			'Mon Jan 15 2024 10:30:00 GMT+0000',
			'1/15/2024 10:30:00',
			'2024-03-01',
		].join('\n');

		const formats = scanDates(content).map((d) => d.format);
		expect(formats).toEqual([
			'iso',
			'rfc2822',
			'unix',
			'utc',
			'local',
			'simple',
		]);
	});

	it('reports real line/column positions', () => {
		const dates = scanDates('x\n  created: 2024-01-15\n');
		expect(dates).toHaveLength(1);
		expect(dates[0]?.position).toEqual({ line: 2, column: 12 });
		expect(dates[0]?.context).toBe('created: 2024-01-15');
	});

	it('drops a bare date contained inside an ISO at the same offset', () => {
		const dates = scanDates('"2024-01-15T10:30:00Z"');
		expect(dates.map((d) => d.format)).toEqual(['iso']);
	});

	it('keeps the same string as a separate occurrence elsewhere', () => {
		const dates = scanDates('2024-01-15T10:30:00Z,2024-01-15');
		expect(dates.map((d) => d.format)).toEqual(['iso', 'simple']);
	});

	it('rejects digit runs that are no epoch unit at all', () => {
		// 17 digits is neither microseconds (16) nor nanoseconds (19).
		expect(scanDates('id 12345678901234567')).toHaveLength(0);
	});

	// The fractional part of a float is a digit run like any other: 16
	// digits after a decimal point are 16 digits, and without the point
	// in the lookbehind they are microseconds. The fraction here lands
	// inside the plausible window on purpose, so the lookbehind is the
	// only thing that can reject it.
	it('does not read the fraction of a float as an epoch', () => {
		expect(scanDates('RATIO = 1.2345678901234567')).toHaveLength(0);
		expect(scanDates('ratio = 0.1705314645123')).toHaveLength(0);
		expect(scanDates('share = 0.20240115')).toHaveLength(0);
		// The digits themselves are still an epoch when they stand alone.
		expect(scanDates('1705314645123456')).toHaveLength(1);
	});

	// The window is what separates an epoch from a number that merely has
	// 13, 16 or 19 digits. Every one of these was a date before it,
	// between 2113 and 2286.
	it('rejects an epoch outside the plausible window', () => {
		expect(scanDates('const maxSafe = 9007199254740991;')).toHaveLength(0);
		expect(scanDates('card 4532015112830366')).toHaveLength(0);
		expect(scanDates('truncated 4532015112830')).toHaveLength(0);
		expect(scanDates('truncated 9007199254740')).toHaveLength(0);
		expect(scanDates('9999999999999999999')).toHaveLength(0);
	});

	// The boundary, both ends and every width that shares the window, so
	// none of them can move by accident.
	it('ends the window at the year 2100', () => {
		// 4102444799999 is 2099-12-31T23:59:59.999Z.
		for (const [inside, outside] of [
			['4102444799999', '4102444800000'],
			['4102444799999123', '4102444800000123'],
			['4102444799999123456', '4102444800000123456'],
		]) {
			expect(scanDates(inside as string)).toHaveLength(1);
			expect(scanDates(outside as string)).toHaveLength(0);
		}
	});

	// A window bounds instants, not digits. This one is 2005-03-18 and is
	// indistinguishable from a real timestamp by any rule that does not
	// look at the characters.
	it('still reads a run of one digit that lands inside the window', () => {
		expect(scanDates('1111111111111111111')).toHaveLength(1);
	});

	it('accepts exactly-10 and exactly-13 digit epochs and scales seconds', () => {
		const dates = scanDates('1705312200 and 1705312200123');
		expect(dates.map((d) => d.timestamp)).toEqual([
			1705312200000, 1705312200123,
		]);
	});

	it('rejects 10-digit runs outside the plausible epoch range', () => {
		expect(scanDates('serial 0000000001')).toHaveLength(0);
	});

	it('does not emit values whose timestamp cannot be parsed', () => {
		// Month 13 cannot parse; v1.x emitted it with a NaN timestamp.
		expect(scanDates('2024-13-45T99:99:99Z')).toHaveLength(0);
		expect(scanDates('date: 13/45/2024 99:99:99')).toHaveLength(0);
	});

	it('matches format-specific specs across lines and lets base formats win at equal ranges', () => {
		const content = "new Date(\n\t'March 5, 2024',\n)";
		const spec = {
			pattern: /\bnew\s+Date\s*\(\s*(['"`])([^'"`\n]+)\1\s*,?\s*\)/dg,
			format: 'custom' as const,
		};
		const dates = scanDates(content, [spec]);
		expect(dates).toHaveLength(1);
		expect(dates[0]?.value).toBe('March 5, 2024');
		expect(dates[0]?.format).toBe('custom');
		expect(dates[0]?.position).toEqual({ line: 2, column: 3 });
	});

	it('emits results sorted by document position', () => {
		const dates = scanDates('2024-03-01\n2024-01-15 then 2024-02-02');
		expect(dates.map((d) => d.value)).toEqual([
			'2024-03-01',
			'2024-01-15',
			'2024-02-02',
		]);
	});
});
