import { describe, expect, it } from 'vitest';
import type { DateValue } from '../types';
import { analyzeDates } from './statistics';

function date(value: string, line: number): DateValue {
	return {
		value,
		format: 'simple',
		timestamp: Date.parse(value),
		position: { line, column: 1 },
		context: value,
	};
}

describe('analyzeDates', () => {
	it('handles an empty input', () => {
		const analysis = analyzeDates([]);
		expect(analysis.statistics.total).toBe(0);
		expect(analysis.anomalies).toEqual([]);
		expect(analysis.patterns).toEqual([]);
		expect(analysis.clusters).toEqual([]);
		expect(analysis.gaps).toEqual([]);
	});

	it('counts totals, uniques, and duplicates', () => {
		const analysis = analyzeDates([
			date('2024-01-15', 1),
			date('2024-01-15', 2),
			date('2024-01-16', 3),
		]);
		expect(analysis.statistics.total).toBe(3);
		expect(analysis.statistics.unique).toBe(2);
		expect(analysis.statistics.duplicates).toBe(1);
	});

	it('computes the range between earliest and latest', () => {
		const analysis = analyzeDates([
			date('2024-01-01', 1),
			date('2024-01-31', 2),
		]);
		expect(analysis.statistics.earliest?.toISOString()).toBe(
			'2024-01-01T00:00:00.000Z',
		);
		expect(analysis.statistics.latest?.toISOString()).toBe(
			'2024-01-31T00:00:00.000Z',
		);
		expect(analysis.statistics.range).toBe(30 * 24 * 60 * 60 * 1000);
	});

	it('tracks format distribution', () => {
		const iso: DateValue = {
			value: '2024-01-15T10:30:00Z',
			format: 'iso',
			timestamp: Date.parse('2024-01-15T10:30:00Z'),
			position: { line: 1, column: 1 },
			context: '',
		};
		const analysis = analyzeDates([iso, date('2024-01-16', 2)]);
		expect(analysis.statistics.formats.iso).toBe(1);
		expect(analysis.statistics.formats.simple).toBe(1);
	});

	it('finds clusters and gaps in a spread of dates', () => {
		const clustered = [
			date('2024-01-01', 1),
			date('2024-01-02', 2),
			date('2024-01-03', 3),
			date('2024-06-01', 4),
		];
		const analysis = analyzeDates(clustered);
		expect(analysis.clusters.length).toBeGreaterThanOrEqual(1);
		expect(analysis.gaps.length).toBeGreaterThanOrEqual(1);
	});

	it('flags anomalies for far-future dates', () => {
		const analysis = analyzeDates([
			date('2024-01-15', 1),
			date('2124-01-15', 2),
		]);
		expect(analysis.anomalies.length).toBeGreaterThanOrEqual(1);
	});
});
