import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { extractDates } from './extract';

/**
 * Characterization tests: pin the CURRENT extraction output per format,
 * including known bugs (html/js emit the same date multiple times with no
 * dedupe, unix timestamps false-positive inside longer digit runs, XML
 * comment filtering shifts line numbers, per-line regex misses multiline
 * constructs, the CSV overlap filter drops a real cell that is a substring
 * of another date on the same line, log merges standard + log-specific
 * passes without cross-dedupe). Behavior changes must update these
 * snapshots in the same commit, so every output diff is explicit.
 *
 * Time is faked (syslog lines borrow the current year) and tests run with
 * TZ=UTC (local-format timestamps parse in machine TZ otherwise).
 */

const FIXTURES: ReadonlyArray<{ fixture: string; languageId: string }> = [
	{ fixture: 'dates.json', languageId: 'json' },
	{ fixture: 'dates.yaml', languageId: 'yaml' },
	{ fixture: 'dates.csv', languageId: 'csv' },
	{ fixture: 'dates.xml', languageId: 'xml' },
	{ fixture: 'dates.log', languageId: 'log' },
	{ fixture: 'dates.log', languageId: 'plaintext' },
	{ fixture: 'dates.js', languageId: 'javascript' },
	{ fixture: 'dates.js', languageId: 'typescript' },
	{ fixture: 'dates.html', languageId: 'html' },
];

describe('extraction characterization', () => {
	beforeAll(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	for (const { fixture, languageId } of FIXTURES) {
		it(`${fixture} as ${languageId}`, async () => {
			const content = readFileSync(
				join(__dirname, '__fixtures__', fixture),
				'utf8',
			);
			const result = await extractDates(content, languageId);
			expect(result).toMatchSnapshot();
		});
	}

	// A language with no extractor of its own is read with the patterns
	// every format shares, where it used to return an empty result that
	// was indistinguishable from a file with no dates in it.
	it('an unsupported language is read with the shared patterns', async () => {
		const result = await extractDates('shipped 2024-01-15', 'python');
		expect(result.success).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.dates.map((date) => date.value)).toEqual(['2024-01-15']);
	});

	// And only those: a syslog line is a date in a log file and three
	// words in a Python one.
	it('the shared patterns are all an unsupported language gets', async () => {
		const result = await extractDates('Jan 15 10:30:47', 'python');
		expect(result.dates).toHaveLength(0);
	});
});
