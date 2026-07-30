import { describe, expect, it } from 'vitest';
import type { DateValue } from '../types';
import { convertDates, getAvailableFormats } from './dateConverter';

const ISO: DateValue = {
	value: '2024-01-15T10:30:00Z',
	format: 'iso',
	timestamp: Date.parse('2024-01-15T10:30:00Z'),
	position: { line: 1, column: 1 },
	context: '',
};

describe('convertDates', () => {
	it('converts to unix seconds', () => {
		const [result] = convertDates([ISO], { targetFormat: 'unix' });
		expect(result?.converted).toBe('1705314600');
	});

	it('converts to simple date', () => {
		const [result] = convertDates([ISO], { targetFormat: 'simple' });
		expect(result?.converted).toBe('2024-01-15');
	});

	it('converts to rfc2822/utc strings', () => {
		const [rfc] = convertDates([ISO], { targetFormat: 'rfc2822' });
		expect(rfc?.converted).toContain('Mon, 15 Jan 2024');
	});

	it('applies custom format strings', () => {
		const [result] = convertDates([ISO], {
			targetFormat: 'custom',
			customFormat: 'YYYY/MM/DD HH:mm',
		});
		expect(result?.converted).toMatch(/^2024\/01\/15 \d{2}:\d{2}$/);
	});

	it('falls back to ISO for custom without a format string', () => {
		const [result] = convertDates([ISO], { targetFormat: 'custom' });
		expect(result?.format).toBe('iso');
		expect(result?.converted).toBe('2024-01-15T10:30:00.000Z');
	});

	it('skips values without a timestamp instead of throwing', () => {
		const { timestamp: _dropped, ...rest } = ISO;
		const broken: DateValue = rest;
		const results = convertDates([broken, ISO], { targetFormat: 'unix' });
		expect(results).toHaveLength(1);
	});
});

describe('getAvailableFormats', () => {
	it('offers every target the converter implements', () => {
		const formats = getAvailableFormats().map((f) => f.format);
		expect(formats).toEqual([
			'iso',
			'rfc2822',
			'unix',
			'utc',
			'local',
			'simple',
			'custom',
		]);
	});
});
