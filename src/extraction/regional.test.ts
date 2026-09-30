import { describe, expect, it } from 'vitest';
import { scanDates } from './heuristics';
import { numericDate, writtenDate } from './regional';

const local = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) =>
	new Date(y, m - 1, d, h, mi, s).getTime();

describe('numericDate', () => {
	it('reads the order from the value when only one reading is a date', () => {
		for (const order of ['mdy', 'dmy'] as const) {
			expect(numericDate('15/01/2024', order)).toBe(local(2024, 1, 15));
			expect(numericDate('1/15/2024', order)).toBe(local(2024, 1, 15));
		}
	});

	it('follows the order for an ambiguous value', () => {
		expect(numericDate('05/01/2024', 'mdy')).toBe(local(2024, 5, 1));
		expect(numericDate('05/01/2024', 'dmy')).toBe(local(2024, 1, 5));
		expect(numericDate('05-01-2024', 'dmy')).toBe(local(2024, 1, 5));
	});

	it('reads dotted dates day first whatever the order', () => {
		expect(numericDate('05.01.2024', 'mdy')).toBe(local(2024, 1, 5));
	});

	it('reads a clock, with or without seconds and a meridiem', () => {
		expect(numericDate('15/01/2024 10:30:45', 'mdy')).toBe(
			local(2024, 1, 15, 10, 30, 45),
		);
		expect(numericDate('15.01.2024 10:30', 'mdy')).toBe(
			local(2024, 1, 15, 10, 30),
		);
		expect(numericDate('1/15/2024 3:30 PM', 'mdy')).toBe(
			local(2024, 1, 15, 15, 30),
		);
		expect(numericDate('1/15/2024 12:05am', 'mdy')).toBe(
			local(2024, 1, 15, 0, 5),
		);
	});

	it('refuses what is not a real date rather than rolling it over', () => {
		for (const value of [
			'31/02/2024',
			'13/13/2024',
			'0/5/2024',
			'29/02/2023',
			'1/15/2024 24:00',
			'1/15/2024 13:00 PM',
			'1/1/1899',
			'1.2.3000',
		]) {
			expect(numericDate(value, 'dmy'), value).toBeNaN();
		}
		expect(numericDate('29/02/2024', 'dmy')).toBe(local(2024, 2, 29));
	});
});

describe('writtenDate', () => {
	it('reads the month in either position, abbreviated or in full', () => {
		for (const value of [
			'15 Jan 2024',
			'15th January, 2024',
			'15-JAN-2024',
			'Jan 15, 2024',
			'January 15th 2024',
			'Jan. 15, 2024',
		]) {
			expect(writtenDate(value), value).toBe(local(2024, 1, 15));
		}
		expect(writtenDate('1 Sept 2024')).toBe(local(2024, 9, 1));
	});

	it('refuses a day the month does not have', () => {
		expect(writtenDate('31 Apr 2024')).toBeNaN();
	});
});

describe('regional patterns in the scan', () => {
	const values = (text: string, order: 'mdy' | 'dmy' = 'mdy') =>
		scanDates(text, [], order).map((d) => d.value);

	it('finds each shape and nothing around it', () => {
		expect(
			values(
				'a 15/01/2024 b 15.01.2024 c 15-01-2024 d 15 Jan 2024 e Jan 15, 2024',
			),
		).toEqual([
			'15/01/2024',
			'15.01.2024',
			'15-01-2024',
			'15 Jan 2024',
			'Jan 15, 2024',
		]);
	});

	it('keeps version strings, addresses and longer runs out', () => {
		expect(
			values('v1.2.2024.5 192.168.1.1 1.15.01.2024 555-12-2024-01'),
		).toEqual([]);
	});

	it('folds ASCII case only, as the crate does', () => {
		expect(values('x JAN 15, 2024')).toEqual(['JAN 15, 2024']);
		expect(values('\u212aJan 15 2024')).toEqual(['Jan 15 2024']);
		expect(values('1 Augu\u017ft 2024')).toEqual([]);
	});

	it('leaves a longer notation that contains one to that notation', () => {
		const dates = scanDates('Mon, 15 Jan 2024 10:30:45 GMT');
		expect(dates.map((d) => d.format)).toEqual(['rfc2822']);
	});
});
