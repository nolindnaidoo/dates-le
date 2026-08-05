import { describe, expect, it } from 'vitest';
import { formatDateSpan } from './duration';

describe('formatDateSpan', () => {
	it('renders sub-second spans in milliseconds', () => {
		expect(formatDateSpan(1)).toBe('1 millisecond');
		expect(formatDateSpan(500)).toBe('500 milliseconds');
	});

	it('renders a year of dates in days, not hours', () => {
		// The analyze report used an elapsed-time formatter here and produced
		// "8760.00h" for a one-year span.
		expect(formatDateSpan(365 * 24 * 60 * 60 * 1000)).toBe('365 days');
	});

	it('renders sub-hour gaps usefully', () => {
		// The statistics formatter only emitted days or hours, so this read
		// "0 hour" — wrong unit and mispluralised.
		expect(formatDateSpan(45 * 60 * 1000)).toBe('45 minutes');
		expect(formatDateSpan(30 * 1000)).toBe('30 seconds');
	});

	it('pluralises on the value, not on "greater than one"', () => {
		expect(formatDateSpan(24 * 60 * 60 * 1000)).toBe('1 day');
		expect(formatDateSpan(2 * 24 * 60 * 60 * 1000)).toBe('2 days');
		expect(formatDateSpan(60 * 60 * 1000)).toBe('1 hour');
	});

	it('crosses each unit boundary at the right point', () => {
		expect(formatDateSpan(999)).toBe('999 milliseconds');
		expect(formatDateSpan(1000)).toBe('1 second');
		expect(formatDateSpan(59 * 1000)).toBe('59 seconds');
		expect(formatDateSpan(60 * 1000)).toBe('1 minute');
		expect(formatDateSpan(59 * 60 * 1000)).toBe('59 minutes');
		expect(formatDateSpan(60 * 60 * 1000)).toBe('1 hour');
		expect(formatDateSpan(23 * 60 * 60 * 1000)).toBe('23 hours');
		expect(formatDateSpan(24 * 60 * 60 * 1000)).toBe('1 day');
	});

	it('reports the magnitude of a negative span', () => {
		// Unsorted input can produce one; "-3 days" reads as a bug either way.
		expect(formatDateSpan(-3 * 24 * 60 * 60 * 1000)).toBe('3 days');
	});

	it('handles zero', () => {
		expect(formatDateSpan(0)).toBe('0 milliseconds');
	});
});
