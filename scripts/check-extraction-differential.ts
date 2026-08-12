/**
 * The generated half of the parity story.
 *
 * `check-extraction-parity.ts` replays a corpus somebody wrote by hand.
 * This generates documents nobody thought of — a format, a value and a
 * wrapper, combined from a printed seed — and requires the two servers
 * to answer identically.
 *
 * **Scope: the shared `extract_dates` MCP tool, and only that.** One
 * tool name, one schema, two servers; an agent that asks `extract_dates`
 * must get the same answer whichever server it reached, so a divergence
 * here is a defect in the contract rather than a difference of opinion.
 *
 * The two *surfaces* are allowed to differ and do: the extension is
 * IDE-first (one open buffer, a person reading results in an editor) and
 * the CLI is terminal-first (trees, exit codes, piping, automation).
 * `--strict`, `--values`, `--sort`, `--tz`, `--year`, the walk, the exit
 * codes and JSON Lines are terminal-first capabilities with no editor
 * equivalent, and none of them is drift. This script deliberately does
 * not compare CLI output against extension output — they answer
 * different questions.
 *
 * Run:
 *   cd crate && cargo build --release
 *   TZ=America/New_York bun scripts/check-extraction-differential.ts
 *
 * Environment:
 *   DATES_LE_BIN    the built binary, if it is not under crate/target
 *   DIFFERENTIAL_SEED  a seed, printed on every run so a failure replays
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const CORPUS = join(ROOT, 'crate', 'fixtures');

/**
 * The zone is pinned for the same reason the corpus pins one: several of
 * the shapes carry no timezone, so their instant is a property of the
 * machine — and both servers have to be standing on the same machine for
 * the comparison to mean anything. A zone with daylight saving is the
 * only kind that can catch a wrong conversion.
 */
const TIMEZONE = 'America/New_York';

const seed = Number(process.env.DIFFERENTIAL_SEED ?? 20_240_115);
console.log(`differential: seed ${seed}, TZ=${TIMEZONE}`);

/** A deterministic 32-bit generator, so a seed reproduces a run exactly. */
function generator(from: number): () => number {
	let state = from >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/**
 * The formats a caller may name, plus names nothing recognises — which
 * are not a refusal on either server and must fall back identically.
 */
const FORMATS = [
	'json',
	'yaml',
	'csv',
	'xml',
	'log',
	'plaintext',
	'javascript',
	'typescript',
	'html',
	'toml',
	'markdown',
	'rust',
	'python',
	'jsonc',
	'yml',
	'tsx',
	'htm',
	'md',
	// The name is normalised before it is looked up, and the two
	// languages do not agree about what whitespace is: JavaScript's
	// `trim` strips U+FEFF and keeps U+0085, and Rust's strips U+0085
	// and keeps U+FEFF. A format name carrying a byte-order mark is
	// ordinary — anything that read it out of a file that Notepad saved
	// has one.
	'\u{feff}json',
	'json\u{feff}',
	'\u{85}json',
	'  json  ',
	'.json',
	'..json',
	'JSON',
];

/**
 * Every wrapper a value can arrive in. The point of the cross-product is
 * that a format-specific rule — XML comment masking, a constructor
 * argument, a `datetime=` attribute — meets a value it was never written
 * for.
 */
const WRAPPERS: ReadonlyArray<readonly [string, (value: string) => string]> = [
	['bare', (value) => value],
	['quoted', (value) => `{"at": "${value}"}`],
	['hash comment', (value) => `# ${value}\nname = "x"\n`],
	['slash comment', (value) => `// ${value}\nconst x = 1;\n`],
	['xml comment', (value) => `<a>1</a><!-- ${value} --><b>2</b>`],
	// The comment nobody closed. Two implementations of "mask what is
	// inside a comment" can disagree about where an unclosed one ends,
	// and the answer is the rest of the document or none of it.
	['unclosed xml comment', (value) => `<a>1</a><!-- ${value}`],
	['attribute', (value) => `<time datetime="${value}">then</time>`],
	['meta tag', (value) => `<meta name="date" content="${value}">`],
	['constructor', (value) => `const at = new Date('${value}');`],
	['mid-line', (value) => `deployed at ${value} by the release job\n`],
	['end of file, no newline', (value) => `first line\nlast: ${value}`],
	['crlf', (value) => `first\r\n${value}\r\nlast\r\n`],
	['twice on a line', (value) => `${value},${value}`],
	// The whitespace inside a construct rather than inside a value.
	// This is where the two languages' `\s` actually changes an answer:
	// the attribute or the call is the only thing making the string a
	// date, so failing to match the separator loses it entirely.
	[
		'attribute split by a byte-order mark',
		(value) => `<time datetime\u{feff}="${value}">then</time>`,
	],
	[
		'attribute split by a next-line character',
		(value) => `<time datetime\u{85}="${value}">then</time>`,
	],
	[
		'constructor split by a byte-order mark',
		(value) => `const at = new\u{feff}Date('${value}');`,
	],
	[
		'constructor split by a next-line character',
		(value) => `const at = new\u{85}Date('${value}');`,
	],
	['after a multibyte run', (value) => `café — naïve 🗓 ${value}`],
];

/**
 * Values the tool might have to resolve. The oracle's own inputs are the
 * spine of this — they are V8's answers to 154 strings, refusals
 * included, so feeding them through every format and wrapper is the
 * cheapest way to reach a rule neither implementation was written
 * against.
 */
function values(): string[] {
	const oracle = JSON.parse(
		readFileSync(join(CORPUS, 'date-parse.json'), 'utf8'),
	) as { cases: Array<{ input: string }> };

	return [
		...oracle.cases.map((entry) => entry.input),
		// The four shapes V8 answers NaN to, which live above `Date.parse`
		// on both sides.
		'2024-W03',
		'2024-W03-7',
		'2024-W53',
		'2015-W01-1',
		'2024-015',
		'2024-001',
		'2023-366',
		'20240115',
		'20240115T103045Z',
		'20240115T103045+0530',
		'18991231',
		'Mon, 15 Jan 2024 10:30:45 CEST',
		'Mon, 15 Jan 2024 10:30:45 IST',
		'Mon, 15 Jan 2024 10:30:45 HISTORY',
		// The epochs, and the digit runs that only look like them.
		'1705314645',
		'1705314645123',
		'1705314645123456',
		'1705314645123456789',
		'5551234567',
		'4532015112830366',
		'9007199254740991',
		'1111111111111111111',
		'0.20240115',
		// The log shapes, which only two of the formats read.
		'Jan 15 10:30:47',
		'[15/Jan/2024:10:30:08 +0000]',
		'2024-01-15 10:30:45.123',
		// The same whitespace disagreement, this time inside the patterns
		// rather than in the format name: every `\s` in them is Unicode
		// in Rust and the language spec's set in JavaScript, and the two
		// differ by exactly these two characters.
		'Mon,\u{feff}15 Jan 2024 10:30:45 GMT',
		'Mon,\u{85}15 Jan 2024 10:30:45 GMT',
		'Mon Jan 15 2024 10:30:45\u{feff}GMT+0000',
		'Jan\u{feff}15 10:30:47',
		'Jan\u{85}15 10:30:47',
		'2024-01-15\u{85}10:30:45',
		'2024-01-15\u{feff}10:30:45',
		// Nothing at all, so "found something" is not the only outcome
		// exercised.
		'not a date',
		'',
	];
}

interface Document {
	readonly name: string;
	readonly content: string;
	readonly arguments: Record<string, unknown>;
}

function documents(): Document[] {
	const random = generator(seed);
	const pool = values();
	const built: Document[] = [];

	// A deterministic sweep first: every format meets every wrapper, so
	// the cross-product is covered whatever the seed does.
	for (const format of FORMATS) {
		for (const [wrapper, wrap] of WRAPPERS) {
			built.push({
				name: `${format} / ${wrapper} / 2024-01-15T10:30:45Z`,
				content: wrap('2024-01-15T10:30:45Z'),
				arguments: { format },
			});
		}
	}

	// Then the seeded half: every value, in four combinations it was not
	// written for.
	for (const value of pool) {
		for (let repeat = 0; repeat < 4; repeat += 1) {
			const format = FORMATS[Math.floor(random() * FORMATS.length)] as string;
			const [wrapper, wrap] = WRAPPERS[
				Math.floor(random() * WRAPPERS.length)
			] as readonly [string, (value: string) => string];
			// A quarter of them arrive by filename instead of by format,
			// because the two servers resolve that from their own alias
			// table and the tables have to agree.
			const byFilename = random() < 0.25;
			built.push({
				name: `${format} / ${wrapper} / ${JSON.stringify(value)}`,
				content: wrap(value),
				arguments: byFilename
					? { filename: `document.${format}` }
					: { format },
			});
		}
	}

	return built;
}

/** The crate's MCP server, asked every document over one JSON-RPC session. */
async function answersFromTheCrate(
	built: readonly Document[],
): Promise<string[]> {
	const binary =
		process.env.DATES_LE_BIN ??
		['release', 'debug']
			.map((profile) => join(ROOT, 'crate', 'target', profile, 'dates-le'))
			.find((candidate) => existsSync(candidate)) ??
		'';
	if (!binary || !existsSync(binary)) {
		throw new Error(
			'no dates-le binary found — run `cd crate && cargo build --release`, ' +
				'or point DATES_LE_BIN at one',
		);
	}

	const server = Bun.spawn([binary, 'mcp'], {
		stdin: 'pipe',
		stdout: 'pipe',
		stderr: 'inherit',
		env: { ...process.env, TZ: TIMEZONE },
	});

	// Read concurrently with writing: a few hundred envelopes are more
	// than a pipe buffer holds, and a server blocked on a full stdout
	// would never read the rest of the requests.
	const reading = new Response(server.stdout).text();

	const requests = built
		.map((document, id) =>
			JSON.stringify({
				jsonrpc: '2.0',
				id,
				method: 'tools/call',
				params: {
					name: 'extract_dates',
					arguments: { content: document.content, ...document.arguments },
				},
			}),
		)
		.join('\n');
	server.stdin.write(`${requests}\n`);
	server.stdin.end();

	const output = await reading;
	await server.exited;

	const answers: string[] = [];
	for (const line of output.split('\n').filter(Boolean)) {
		const response = JSON.parse(line);
		if (response.error) {
			throw new Error(
				`the crate's server refused request ${response.id}: ${JSON.stringify(response.error)}`,
			);
		}
		answers[response.id] = JSON.stringify(response.result.structuredContent);
	}
	if (answers.length !== built.length) {
		throw new Error(
			`the crate's server answered ${answers.length} of ${built.length} requests`,
		);
	}
	return answers;
}

/** The extension's tool, asked the same documents in this process. */
async function answersFromTheExtension(
	built: readonly Document[],
): Promise<string[]> {
	const { TOOLS } = await import('../src/mcp/tools');
	const tool = TOOLS.find((candidate) => candidate.name === 'extract_dates');
	if (!tool) throw new Error('the extension no longer offers extract_dates');

	const answers: string[] = [];
	for (const document of built) {
		const result = await tool.handler({
			content: document.content,
			...document.arguments,
		});
		answers.push(JSON.stringify(result));
	}
	return answers;
}

if (process.env.TZ !== TIMEZONE) {
	console.error(
		`differential: this must run under TZ=${TIMEZONE}; got ${process.env.TZ ?? '(unset)'}`,
	);
	process.exit(1);
}

const built = documents();
console.log(`differential: ${built.length} generated documents`);

const [crate, extension] = await Promise.all([
	answersFromTheCrate(built),
	answersFromTheExtension(built),
]);

const failures: string[] = [];
for (const [index, document] of built.entries()) {
	if (crate[index] === extension[index]) continue;
	failures.push(
		[
			`  ${document.name}`,
			`    seed:      ${seed} (index ${index})`,
			`    document:  ${JSON.stringify(document.content)}`,
			`    arguments: ${JSON.stringify(document.arguments)}`,
			`    extension: ${extension[index]}`,
			`    crate:     ${crate[index]}`,
		].join('\n'),
	);
}

if (failures.length > 0) {
	console.error(
		`\nextract_dates differential: ${failures.length} of ${built.length} documents disagree.\n\n` +
			'This is the SHARED tool, so a disagreement here is a defect rather than a\n' +
			'surface difference: one tool name, one schema, two servers, and an agent must\n' +
			'get the same answer whichever it reached. Differences between the CLI and the\n' +
			'editor — the walk, --strict, --sort, exit codes — are not compared here and\n' +
			'are not what this is reporting.\n\n' +
			`Replay with DIFFERENTIAL_SEED=${seed}.\n`,
	);
	for (const failure of failures.slice(0, 20)) console.error(`${failure}\n`);
	if (failures.length > 20) {
		console.error(`  … and ${failures.length - 20} more\n`);
	}
	process.exit(1);
}

console.log(
	`extract_dates differential: ${built.length} documents, both servers agree`,
);
