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

	it('rejects unix timestamps embedded in longer digit runs', () => {
		expect(scanDates('id 12345678901234567')).toHaveLength(0);
		expect(scanDates('const maxSafe = 9007199254740991;')).toHaveLength(0);
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
