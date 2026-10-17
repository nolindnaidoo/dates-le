/**
 * Requires the npm command line to behave exactly as the Rust one does.
 *
 * Both install a command named `dates-le`, so a person or a CI step cannot tell
 * which one they have. This is a different contract from
 * `check-extraction-parity.ts`, which holds the extension's engine equal to
 * the crate's: here the whole terminal surface is compared, the walk, the
 * positions, the instants and the zones they resolve in, the exit codes,
 * stdout and stderr byte for byte, and every reply `dates-le mcp` writes,
 * byte for byte too.
 *
 * Every case runs both binaries over one generated tree with stdout piped,
 * which is how a script sees them. `--version` is compared too: every surface
 * carries one version, and two binaries of one name disagreeing about it is
 * the first thing a person comparing them would see.
 *
 * Run: bun run build:cli && cargo build --locked --manifest-path crate/Cargo.toml
 *      bun scripts/check-cli-parity.ts
 */
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmdirSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const RUST =
	process.env.DATES_LE_BIN ??
	join(
		ROOT,
		'crate',
		'target',
		'debug',
		`dates-le${process.platform === 'win32' ? '.exe' : ''}`,
	);
const NODE_CLI = join(ROOT, 'cli', 'cli.js');
/**
 * Node, by name, not `process.execPath`: this script runs under Bun, and the
 * package is run by Node wherever `npx` runs it. Bun's errors are not Node's.
 */
const NODE = process.env.NODE_BIN ?? 'node';

interface Case {
	readonly args: readonly string[];
	readonly stdin?: string | Buffer;
}

interface Outcome {
	readonly status: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

for (const [label, path] of [
	['the Rust binary', RUST],
	['cli/cli.js', NODE_CLI],
] as const) {
	if (!existsSync(path)) {
		console.error(`FAIL: ${label} is missing at ${path}. Build it first.`);
		process.exit(1);
	}
}

const tree = mkdtempSync(join(tmpdir(), 'dates-le-cli-parity-'));
const created: string[] = [];
const dirs: string[] = [tree];

function dir(relative: string): void {
	mkdirSync(join(tree, relative));
	dirs.push(join(tree, relative));
}

function file(relative: string, content: string | Buffer): void {
	writeFileSync(join(tree, relative), content);
	created.push(join(tree, relative));
}

function link(relative: string, target: string): void {
	// Windows grants symlinks to administrators and developer mode only, and
	// both binaries then see the same tree without the link.
	try {
		symlinkSync(target, join(tree, relative));
	} catch {
		return;
	}
	created.push(join(tree, relative));
}

const canLock = process.platform !== 'win32' && process.getuid?.() !== 0;

const LINES = [
	'Released 2024-01-15T10:30:45Z, patched 2024-01-15T10:30:45.123+05:30.',
	'Basic 20240115T103045Z, week 2024-W03-1, ordinal 2024-015.',
	'RFC: Mon, 15 Jan 2024 10:30:45 GMT and Tue, 16 Jan 2024 08:00:00 +0200',
	'Numeric 05/01/2024, 15/01/2024, 1/15/2024 and 05.01.2024.',
	'Written March 5, 2024 and 5 March 2024 and Mar 5 2024.',
	'Local 2024-01-15 10:30:45 and 2024-03-10 02:30:00 (a gap in New York).',
	'Epochs 1705314645 1705314645123 1705314645123456 1705314645123456789',
	'Zones 15 Jan 2024 10:30:45 CEST and 15 Jan 2024 10:30:45 IST',
	'Far 9999-12-31T23:59:59Z and 0001-01-01T00:00:00Z',
	'emoji 🎯 then 2024-02-29 after it, and ünï 2023-02-29 too',
	'2024-01-15 2024-01-15 2024-01-15',
	'',
].join('\n');

const LOG = [
	'2024-01-15 10:30:45.123 INFO started',
	'Jan 15 10:30:45 host app[42]: syslog without a year',
	'Feb 29 00:00:00 host app[42]: only a leap year has this',
	'127.0.0.1 - - [15/Jan/2024:10:30:08 +0000] "GET / HTTP/1.1" 200 2',
	'',
].join('\n');

function build(): void {
	dir('repo');
	dir('repo/.git');
	dir('repo/.git/info');
	file('repo/.git/info/exclude', 'excluded.md\n');
	file('repo/.gitignore', 'ignored.md\nbuild/\n*.tmp\n!keep.tmp\n');
	file('repo/.ignore', 'dot-ignored.md\n');
	file('repo/notes.md', LINES);
	file('repo/app.log', LOG);
	file('repo/server.txt', LOG);
	file(
		'repo/data.json',
		'{\n  "created": "2024-01-15T10:30:45Z",\n  "n": 1705314645,\n  "text": "on 05/01/2024",\n  "nested": {"when": "March 5, 2024"}\n}\n',
	);
	file('repo/config.yaml', 'release: 2024-01-15\nnext: "2024-02-01T00:00:00Z"\n# 2023-12-31 in a comment\n');
	file('repo/table.csv', 'id,when\n1,2024-01-15\n2,01/15/2024\n3,15.01.2024\n');
	file('repo/feed.xml', '<feed><updated>2024-01-15T10:30:45Z</updated><!-- 2023-01-01 --></feed>\n');
	file(
		'repo/app.ts',
		"const a = new Date('2024-01-15');\nconst b = Date.parse('March 5, 2024 10:00');\nconst c = moment('2024/02/01');\n",
	);
	file('repo/page.html', '<time datetime="2024-01-15T10:30">Jan 15</time>\n');
	file('repo/Cargo.toml', 'date = 2024-01-15\nstamp = 2024-01-15T10:30:45Z\n');
	file('repo/script.py', 'when = "2024-01-15"  # 2024-02-01\n');
	file('repo/ignored.md', '2024-01-01\n');
	file('repo/excluded.md', '2024-01-02\n');
	file('repo/dot-ignored.md', '2024-01-03\n');
	file('repo/keep.tmp', '2024-01-04\n');
	file('repo/drop.tmp', '2024-01-05\n');
	file('repo/.hidden.md', '2024-01-06\n');
	dir('repo/build');
	file('repo/build/out.md', '2024-01-07\n');
	dir('repo/nested');
	file('repo/nested/.gitignore', 'local.md\n');
	file('repo/nested/local.md', '2024-01-08\n');
	file('repo/nested/kept.md', '2024-01-09\n');
	file('repo/crlf.md', '2024-01-15\r\nMarch 5, 2024\r\n');
	file('repo/bom.md', `\uFEFF2024-01-15 at the start\n`);
	file('repo/empty.md', '');
	file('repo/none.md', 'nothing dated here, only 42 and 3.14\n');
	file('repo/ünïcode.md', 'ünïcode 2024-01-15\n');
	file('repo/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x0d]));
	file('repo/nul.md', Buffer.concat([Buffer.from('2024-01-15 '), Buffer.from([0]), Buffer.from(' x')]));
	file('repo/latin1.md', Buffer.from([0x32, 0x30, 0x32, 0x34, 0x2d, 0x30, 0x31, 0x2d, 0x31, 0x35, 0x20, 0xe9, 0x0a]));
	link('repo/linked.md', 'notes.md');
	link('repo/linked-dir', 'nested');
	dir('loose');
	file('loose/plain.txt', '2024-05-05\n');
	dir('many');
	file('many/stamps.log', '2024-01-15T10:30:45Z\n'.repeat(20_000));
	if (canLock) {
		file('repo/locked.md', '2024-01-10\n');
		chmodSync(join(tree, 'repo', 'locked.md'), 0o000);
		dir('closed');
		dir('closed/shut');
		file('closed/shut/inside.md', '2024-01-11\n');
		file('closed/open.md', '2024-01-12\n');
		chmodSync(join(tree, 'closed', 'shut'), 0o000);
	}
}

function cases(): readonly Case[] {
	const repo = join(tree, 'repo');
	const at = (name: string) => join(repo, name);
	const corpus = join(ROOT, 'crate', 'fixtures', 'documents');
	const stdin = (args: readonly string[], input: string | Buffer): Case => ({
		args: ['--stdin', ...args],
		stdin: input,
	});
	return [
		{ args: ['--help'] },
		{ args: ['--version'] },
		{ args: [repo, '--version'] },
		{ args: [repo, '--help'] },
		{ args: [] },
		{ args: [repo] },
		{ args: [`${repo}/`] },
		{ args: ['repo'] },
		{ args: ['./repo/nested/'] },
		{ args: [repo, '--hidden'] },
		{ args: [repo, '--no-ignore'] },
		{ args: [repo, '--hidden', '--no-ignore'] },
		{ args: [repo, '--strict'] },
		{ args: [repo, '--iso'] },
		{ args: [repo, '--sort'] },
		{ args: [repo, '--dedupe'] },
		{ args: [repo, '--dedupe', '--sort', '--iso'] },
		{ args: [repo, '--values'] },
		{ args: [repo, '--values', '--strict'] },
		{ args: [repo, '--kinds', 'unix'] },
		{ args: [repo, '--kinds', 'iso, unix ,basic', '--iso'] },
		{ args: [repo, '--kinds', 'iso,epoch'] },
		{ args: [repo, '--kinds', ''] },
		{ args: [repo, '--kinds', 'iso,,unix'] },
		{ args: [repo, '--kinds', 'ISO'] },
		{ args: [repo, '--kinds', 'iso\u0085'] },
		{ args: [repo, '--kinds', 'iso\ufeff'] },
		{ args: [repo, '--kinds'] },
		{ args: [repo, '--date-order', 'dmy'] },
		{ args: [repo, '--date-order', 'DMY'] },
		{ args: [repo, '--date-order'] },
		{ args: [repo, '--after', '2024-01-15'] },
		{ args: [repo, '--before', 'March 5, 2024'] },
		{ args: [repo, '--after', '2024-01-01', '--before', '2024-02-01', '--sort'] },
		{ args: [repo, '--after', '15 Jan 2024 10:30:45 CEST'] },
		{ args: [repo, '--after', 'soon'] },
		{ args: [repo, '--after', 'tab\there "quoted" \\ é\u0001'] },
		{ args: [repo, '--before'] },
		{ args: [repo, '--tz', 'UTC', '--iso'] },
		{ args: [repo, '--tz', 'America/New_York', '--iso'] },
		{ args: [repo, '--tz', 'Asia/Kolkata', '--iso', '--sort'] },
		{ args: [repo, '--tz', 'Australia/Lord_Howe', '--iso'] },
		{ args: [repo, '--tz', 'US/Eastern', '--iso'] },
		{ args: [repo, '--tz', 'Etc/GMT+5', '--iso'] },
		{ args: [repo, '--tz', 'utc'] },
		{ args: [repo, '--tz', '+05:00'] },
		{ args: [repo, '--tz', 'Mars/Olympus'] },
		{ args: [repo, '--tz'] },
		{ args: ['--after', '2024-01-15 00:00:00', '--tz', 'America/New_York', repo] },
		{ args: [repo, '--tz', 'UTC', '--tz'] },
		{ args: [repo, '--tz', 'UTC', '--tz', 'nowhere'] },
		{ args: [repo, '--year', '2020', '--iso'] },
		{ args: [repo, '--year', '+2023', '--iso'] },
		{ args: [repo, '--year', '-5', '--iso'] },
		{ args: [repo, '--year', '0', '--iso'] },
		// Not 262143 to 275760: V8 resolves a zone-less syslog line in those
		// years and the crate's chrono cannot, so it drops the line. Only
		// `--year` reaches them; no pattern matches a six-digit year.
		{ args: [repo, '--year', '262142', '--iso'] },
		{ args: [repo, '--year', '9223372036854775807'] },
		{ args: [repo, '--year', '9223372036854775808'] },
		{ args: [repo, '--year', ' 2020'] },
		{ args: [repo, '--year', 'soon'] },
		{ args: [repo, '--year'] },
		{ args: [repo, '--format', 'log'] },
		{ args: [repo, '--format', 'YML'] },
		{ args: [repo, '--format', '.json'] },
		{ args: [repo, '--format', 'rust'] },
		{ args: [repo, '--format', ''] },
		{ args: [repo, '--format'] },
		{ args: [at('notes.md'), '--iso', '--kinds', 'iso,simple,local,rfc2822,utc,week,ordinal,basic,custom,unix'] },
		{ args: [at('app.log'), at('server.txt'), '--year', '2024', '--iso'] },
		{ args: [at('app.log'), '--year', '2023'] },
		{ args: [at('data.json'), at('config.yaml'), at('table.csv'), '--kinds', 'iso,simple,local,unix'] },
		{ args: [at('feed.xml'), at('app.ts'), at('page.html'), at('Cargo.toml'), at('script.py')] },
		{ args: [at('crlf.md'), at('bom.md'), at('empty.md'), at('none.md')] },
		{ args: [at('none.md')] },
		{ args: [at('ünïcode.md')] },
		{ args: [at('logo.png'), at('nul.md'), at('latin1.md')] },
		{ args: [at('latin1.md'), '--strict'] },
		{ args: [at('logo.png'), '--strict'] },
		{ args: [at('ignored.md'), at('.hidden.md'), at('dot-ignored.md')] },
		{ args: [at('notes.md'), at('notes.md')] },
		{ args: [at('nested'), at('nested/kept.md')] },
		{ args: [at('linked.md')] },
		{ args: [at('linked-dir')] },
		{ args: [join(tree, 'loose')] },
		{ args: [join(tree, 'many')] },
		{ args: [join(tree, 'many'), '--values'] },
		...(canLock
			? [
					{ args: [join(tree, 'closed')] },
					{ args: [join(tree, 'closed'), '--strict'] },
					{ args: [at('locked.md')] },
					{ args: [at('locked.md'), '--strict'] },
				]
			: []),
		{ args: [join(tree, 'missing')] },
		{ args: [repo, join(tree, 'missing')] },
		{ args: [repo, '--nope'] },
		{ args: [repo, '--'] },
		{ args: [repo, '-'] },
		{ args: [repo, '-x'] },
		{ args: ['--sort'] },
		{ args: ['--stdin'] },
		{ args: ['--stdin', repo], stdin: '2024-01-15' },
		stdin(['--format', 'log', '--year', '2024'], LOG),
		stdin([], LINES),
		stdin(['--format', 'json'], '{"a": "2024-01-15", "b": 1705314645}'),
		stdin(['--format', 'json', '--kinds', 'unix'], '{"a": "2024-01-15", "b": 1705314645}'),
		stdin(['--format', 'markdown'], `\uFEFF${LINES}`),
		stdin(['--format', 'markdown'], Buffer.from([0x32, 0x30, 0xff, 0x0a])),
		stdin(['--format', 'markdown'], ''),
		stdin(['--values', '--sort'], LINES),
		{ args: [corpus] },
		{ args: [corpus, '--iso', '--tz', 'America/New_York', '--year', '2024'] },
		{ args: [corpus, '--dedupe', '--no-ignore', '--hidden', '--date-order', 'dmy'] },
		{ args: [join(ROOT, 'src', 'extraction', '__fixtures__'), '--tz', 'UTC'] },
	];
}

function run(command: readonly string[], testCase: Case): Outcome {
	const [program, ...rest] = command as [string, ...string[]];
	const result = spawnSync(program, [...rest, ...testCase.args], {
		input: testCase.stdin ?? '',
		cwd: tree,
		maxBuffer: 256 * 1024 * 1024,
	});
	return {
		status: result.status,
		stdout: result.stdout.toString('utf8'),
		stderr: result.stderr.toString('utf8'),
	};
}

function compareCli(): string[] {
	const failures: string[] = [];
	for (const testCase of cases()) {
		const rust = run([RUST], testCase);
		const node = run([NODE, NODE_CLI], testCase);
		for (const field of ['status', 'stdout', 'stderr'] as const) {
			if (rust[field] === node[field]) continue;
			failures.push(
				`dates-le ${testCase.args.join(' ')}\n  ${field} differs\n` +
					describeDifference(String(rust[field]), String(node[field])),
			);
		}
	}
	return failures;
}

function mcpLines(): readonly string[] {
	const repo = join(tree, 'repo');
	let id = 0;
	const request = (method: string, params?: unknown) =>
		JSON.stringify({
			jsonrpc: '2.0',
			id: ++id,
			method,
			...(params === undefined ? {} : { params }),
		});
	const call = (name: string, args?: unknown) =>
		request('tools/call', args === undefined ? { name } : { name, arguments: args });
	const extract = (args: Record<string, unknown>) => call('extract_dates', args);
	const scan = (args: Record<string, unknown>) => call('dates_le_scan', args);
	return [
		request('initialize', { protocolVersion: '2024-11-05' }),
		JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
		request('tools/list'),
		request('ping'),
		request('resources/list'),
		request('tools/call'),
		request('tools/call', { arguments: {} }),
		request('tools/call', null),
		call('no_such_tool', {}),
		JSON.stringify({ jsonrpc: '2.0', id: 'text-id', method: 'ping' }),
		JSON.stringify({ jsonrpc: '2.0', id: null, method: 'ping' }),
		JSON.stringify({ jsonrpc: '2.0', id: { b: 1, a: [2] }, method: 'ping' }),
		JSON.stringify({ id: 77, method: 'ping' }),
		JSON.stringify({ jsonrpc: '2.0', id: 78 }),
		'not json',
		'',
		'   ',
		'[1, 2]',
		`${request('ping')}\r`,
		extract({ content: LINES, format: 'markdown' }),
		extract({ content: LINES, kinds: ['iso', 'unix'], dateOrder: 'dmy' }),
		extract({ content: LOG, filename: 'app.log' }),
		extract({ content: '{"a": "2024-01-15"}', format: 'json', dedupe: true, maxResults: 1 }),
		extract({ content: '2024-01-15', kinds: ['epoch'] }),
		extract({ content: '2024-01-15', kinds: 'iso' }),
		extract({ content: '2024-01-15', dateOrder: 'ymd' }),
		extract({ content: '2024-01-15', dateOrder: null }),
		extract({ content: '2024-01-15', maxResults: 0 }),
		extract({ content: 7 }),
		extract({}),
		call('extract_dates', null),
		call('extract_dates', [1, 2]),
		scan({ path: repo }),
		scan({ paths: [repo, join(tree, 'loose')], dedupe: true, sort: true }),
		scan({ path: repo, hidden: true, ignored: true, kinds: ['iso', 'unix'] }),
		scan({ path: repo, after: '2024-01-15', before: 'March 5, 2024', dateOrder: 'dmy' }),
		scan({ path: repo, after: 'soon' }),
		scan({ path: repo, after: 3 }),
		scan({ path: repo, dateOrder: 'ymd' }),
		scan({ path: repo, dateOrder: null }),
		scan({ path: repo, kinds: ['epoch'] }),
		scan({ path: repo, kinds: null }),
		scan({ path: repo, format: 'log' }),
		scan({ path: repo, format: 'klingon' }),
		scan({ path: join(repo, 'notes.md'), hidden: 'yes' }),
		scan({ paths: [] }),
		scan({ paths: [3] }),
		scan({ path: 3, paths: [join(repo, 'none.md')] }),
		scan({}),
		scan({ path: join(tree, 'missing') }),
		...(canLock ? [scan({ path: join(tree, 'closed') })] : []),
	];
}

function serve(command: readonly string[], input: string | Buffer): Outcome {
	const [program, ...rest] = command as [string, ...string[]];
	const result = spawnSync(program, [...rest, 'mcp'], { input, cwd: tree });
	return {
		status: result.status,
		stdout: result.stdout.toString('utf8'),
		stderr: result.stderr.toString('utf8'),
	};
}

function compareMcp(): string[] {
	const failures: string[] = [];
	const lines = mcpLines();
	const sessions: readonly (readonly [string, string | Buffer])[] = [
		['the whole session', `${lines.join('\n')}\n`],
		['a last line with no newline', lines[3] as string],
		[
			'a line that is not UTF-8',
			Buffer.concat([
				Buffer.from(`${lines[3]}\n`),
				Buffer.from([0x7b, 0xff, 0x7d, 0x0a]),
				Buffer.from(`${lines[3]}\n`),
			]),
		],
	];
	for (const [label, input] of sessions) {
		const rust = serve([RUST], input);
		const node = serve([NODE, NODE_CLI], input);
		for (const field of ['status', 'stdout', 'stderr'] as const) {
			if (rust[field] === node[field]) continue;
			failures.push(
				`dates-le mcp, ${label}\n  ${field} differs\n` +
					describeDifference(String(rust[field]), String(node[field])),
			);
		}
	}
	return failures;
}

/** The first differing line, which is the one worth reading in a long output. */
function describeDifference(rust: string, node: string): string {
	const left = rust.split('\n');
	const right = node.split('\n');
	const index = left.findIndex((line, at) => line !== right[at]);
	const at = index === -1 ? left.length : index;
	const clip = (line: string | undefined) =>
		line === undefined || line.length <= 2000 ? line : `${line.slice(0, 2000)}…`;
	return `  line ${at + 1}\n  rust: ${clip(left[at])}\n  node: ${clip(right[at])}`;
}

function cleanUp(): void {
	const unlock: readonly (readonly [string, number])[] = [
		[join(tree, 'repo', 'locked.md'), 0o600],
		[join(tree, 'closed', 'shut'), 0o700],
	];
	for (const [path, mode] of unlock) if (existsSync(path)) chmodSync(path, mode);
	for (const path of created) unlinkSync(path);
	for (const path of [...dirs].reverse()) rmdirSync(path);
}

build();
let failures: string[];
try {
	failures = [...compareCli(), ...compareMcp()];
} finally {
	cleanUp();
}

if (failures.length > 0) {
	console.error(failures.join('\n\n'));
	console.error(`\nFAIL: ${failures.length} difference(s) between the npm and Rust CLIs`);
	process.exit(1);
}
console.log(
	`OK: the npm CLI matches the Rust CLI on ${cases().length} commands and ${mcpLines().length} MCP lines`,
);
