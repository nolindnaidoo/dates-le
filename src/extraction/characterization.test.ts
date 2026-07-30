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

	it('unsupported language returns empty success', async () => {
		const result = await extractDates('2024-01-15', 'python');
		expect(result.success).toBe(true);
		expect(result.dates).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});
