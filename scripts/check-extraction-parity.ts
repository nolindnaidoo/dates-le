/**
 * Fails when the extension's date extraction drifts from the shared
 * corpus, which the Rust CLI (crate/) also builds against.
 *
 * - extraction.json `documents`: every date found in each corpus
 *   document, with its notation, instant and 1-based position. The
 *   corpus deliberately holds the awkward cases — the same date twice
 *   on one row, a bare date inside an ISO one, a masked XML comment
 *   with a date in it, a column past an emoji, and the digit runs that
 *   look like epochs and are not.
 * - mcp-extract-dates.json: the `extract_dates` tool, which BOTH MCP
 *   servers offer and must answer identically, refusals included.
 *
 * This checks only the extension's side. `cargo test` runs the crate's
 * implementation over the same files, and `crate/fixtures/date-parse.json`
 * holds V8's own answers for the parser the crate reimplements.
 *
 * Two things are pinned rather than read from the machine, because the
 * answers depend on them and a corpus whose answer depends on the day it
 * runs is not a contract:
 *
 * - `TZ`, because four of the six shapes carry no timezone.
 * - the current year, because a syslog line does not carry one. The
 *   global `Date` is stubbed for that, which is a harness, not a change
 *   to the extension: `Date.parse` and `Date.now` are inherited
 *   untouched, and only the no-argument constructor is pinned.
 *
 * Run: TZ=America/New_York bun scripts/check-extraction-parity.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
/** The corpus lives inside the crate so the published package is self-contained. */
const CORPUS = join(ROOT, 'crate', 'fixtures');
const failures: string[] = [];

function fail(message: string): void {
	failures.push(message);
}

function readCorpus(name: string): any {
	return JSON.parse(readFileSync(join(CORPUS, name), 'utf8'));
}

function readDocument(name: string): string {
	return readFileSync(join(CORPUS, 'documents', name), 'utf8');
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, i) => deepEqual(item, b[i]));
	}
	if (typeof a !== 'object' || typeof b !== 'object') return false;
	if (a === null || b === null) return false;
	const keysA = Object.keys(a).sort();
	const keysB = Object.keys(b).sort();
	if (!deepEqual(keysA, keysB)) return false;
	return keysA.every((key) =>
		deepEqual(
			(a as Record<string, unknown>)[key],
			(b as Record<string, unknown>)[key],
		),
	);
}

/**
 * Pin the wall clock before the extraction module is loaded, so the
 * syslog year is the corpus's rather than today's.
 */
function pinTheClock(year: number): void {
	const RealDate = Date;
	// biome-ignore lint/suspicious/noExplicitAny: a test harness standing in for the platform
	(globalThis as any).Date = class extends RealDate {
		// biome-ignore lint/suspicious/noExplicitAny: forwarding every real Date signature
		constructor(...args: any[]) {
			if (args.length === 0) super(`${year}-07-01T12:00:00Z`);
			else super(...(args as []));
		}
	};
}

async function checkDocuments(): Promise<void> {
	const corpus = readCorpus('extraction.json');
	if (!Array.isArray(corpus.documents) || corpus.documents.length === 0) {
		fail('the corpus has no documents');
		return;
	}
	if (process.env.TZ !== corpus.timezone) {
		fail(
			`this corpus is only meaningful under TZ=${corpus.timezone}; got ${process.env.TZ ?? '(unset)'}`,
		);
		return;
	}

	pinTheClock(corpus.year);
	const { extractDates } = await import('../src/extraction/extract');

	for (const testCase of corpus.documents) {
		const result = await extractDates(
			readDocument(testCase.file),
			testCase.fileType,
		);
		// The engine nests the position; the MCP tool flattens it, and the
		// corpus follows the tool because that is the shape both servers
		// publish.
		const actual = [...result.dates].map((date) => ({
			value: date.value,
			format: date.format,
			timestamp: date.timestamp,
			line: date.position?.line,
			column: date.position?.column,
		}));
		if (!deepEqual(actual, testCase.expected)) {
			fail(
				`document "${testCase.name}" (${testCase.file}):\n  expected: ${JSON.stringify(testCase.expected)}\n  got:      ${JSON.stringify(actual)}`,
			);
		}
	}
}

/**
 * `extract_dates` is offered by BOTH MCP servers. They are meant to be
 * the same tool, not two similar ones, so the same corpus runs against
 * both: this function here, and `crate/src/mcp/extract.rs`'s own test
 * there.
 */
async function checkMcpExtractDates(): Promise<void> {
	const cases = readCorpus('mcp-extract-dates.json');
	const { TOOLS } = await import('../src/mcp/tools');
	const tool = TOOLS.find((candidate) => candidate.name === 'extract_dates');
	if (!tool) {
		fail('the extension no longer offers extract_dates');
		return;
	}

	for (const testCase of cases) {
		const args: Record<string, unknown> = { ...testCase.arguments };
		if (testCase.file !== undefined) args.content = readDocument(testCase.file);
		else if (testCase.content !== undefined) args.content = testCase.content;

		if (testCase.expectedError !== undefined) {
			try {
				await tool.handler(args);
				fail(
					`mcp "${testCase.name}": expected it to refuse with ${JSON.stringify(testCase.expectedError)}`,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message !== testCase.expectedError) {
					fail(
						`mcp "${testCase.name}":\n  expected refusal: ${testCase.expectedError}\n  got:              ${message}`,
					);
				}
			}
			continue;
		}

		// Compared as JSON rather than as objects. The extension's value
		// shape carries `timezone`, which extraction never populates, so
		// the live object has the key with `undefined` and the wire does
		// not have it at all. The wire is the contract — it is what an
		// agent receives, and it is the only shape the Rust server can
		// produce.
		const actual = JSON.parse(JSON.stringify(await tool.handler(args)));
		if (!deepEqual(actual, testCase.expected)) {
			fail(
				`mcp "${testCase.name}":\n  expected: ${JSON.stringify(testCase.expected)}\n  got:      ${JSON.stringify(actual)}`,
			);
		}
	}
}

/**
 * The oracle is only an oracle if it was taken from the machine it
 * claims to describe. This does not re-run V8 against every case — the
 * crate does that comparison — it checks the file is intact and still
 * describes the zone the rest of the corpus was built in.
 */
function checkDateParseCorpus(): void {
	const corpus = readCorpus('date-parse.json');
	if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) {
		fail('date-parse.json has no cases');
		return;
	}
	if (corpus.timezone !== readCorpus('extraction.json').timezone) {
		fail('date-parse.json and extraction.json disagree about the timezone');
	}
	for (const entry of corpus.cases) {
		const parsed = Date.parse(entry.input);
		const actual = Number.isNaN(parsed) ? null : parsed;
		if (actual !== entry.timestamp) {
			fail(
				`Date.parse(${JSON.stringify(entry.input)}): corpus says ${entry.timestamp}, this V8 says ${actual}`,
			);
		}
	}
}

// Order matters: the clock stub must be installed before the extraction
// module is imported, and the V8 oracle must be read before it.
checkDateParseCorpus();
await checkDocuments();
await checkMcpExtractDates();

if (failures.length > 0) {
	console.error(`extraction parity: ${failures.length} failure(s)\n`);
	for (const failure of failures) console.error(`  ${failure}\n`);
	process.exit(1);
}
console.log('extraction parity: the extension matches the shared corpus');
