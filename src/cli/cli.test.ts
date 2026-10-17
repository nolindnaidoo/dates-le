import {
	mkdirSync,
	mkdtempSync,
	rmdirSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { parse, type ScanOptions } from './args';
import { rustDebug } from './debug';
import { serve } from './mcp';
import { run } from './run';
import {
	exitCode,
	type FileReport,
	describe as line,
	scanText,
	toIso,
} from './scan';
import { FLAGS, USAGE } from './usage';
import { collect } from './walk';

const YEAR = 2026;
const SCAN: ScanOptions = parse(['x'], YEAR).scan;
const zone = process.env.TZ;

// `--tz` sets the process zone, as the crate sets its own. A worker thread
// does not move `Date` with it, which is why the zone's effect is checked by
// the parity script against the binary rather than here.
afterEach(() => {
	process.env.TZ = zone;
});

describe('usage', () => {
	it('names every flag the parser accepts, and no other', () => {
		const named = new Set(
			USAGE.split(/\s+/)
				.filter((word) => word.startsWith('--'))
				.map((word) => word.replace(/[,.:;·]+$/, ''))
				.filter((word) => word !== '--version'),
		);
		expect([...named].sort()).toEqual([...FLAGS].sort());
	});
});

describe('parse', () => {
	it('defaults to every kind but unix, month first, and the year it is given', () => {
		const cli = parse(['.'], 1999);
		expect(cli.scan.kinds).not.toContain('unix');
		expect(cli.scan.kinds).toHaveLength(9);
		expect(cli.scan.order).toBe('mdy');
		expect(cli.scan.year).toBe(1999);
	});

	it('reads kinds as Rust trims them, and names every kind when it refuses', () => {
		expect(
			parse(['--kinds', ' iso ,\u0085unix', '.'], YEAR).scan.kinds,
		).toEqual(['iso', 'unix']);
		expect(() => parse(['--kinds', 'iso﻿', '.'], YEAR)).toThrow(
			'--kinds needs a comma-separated list of: iso, simple, local, rfc2822, utc, week, ordinal, basic, custom, unix, not "iso\\u{feff}"',
		);
	});

	it('reads a year as an i64 and nothing looser', () => {
		expect(parse(['--year', '+2023', '.'], YEAR).scan.year).toBe(2023);
		expect(parse(['--year', '-5', '.'], YEAR).scan.year).toBe(-5);
		for (const raw of [' 2020', '2020.0', '9223372036854775808', ''])
			expect(() => parse(['--year', raw, '.'], YEAR)).toThrow(
				`--year needs a year, not ${rustDebug(raw)}`,
			);
	});

	it('takes only chrono-tz names for a zone, read before anything else', () => {
		expect(parse(['--tz', 'America/New_York', '.'], YEAR).zone).toBe(
			'America/New_York',
		);
		for (const raw of ['utc', '+05:00', 'Mars/Olympus'])
			expect(() => parse(['--nope', '--tz', raw], YEAR)).toThrow(
				`${rustDebug(raw)} is not an IANA timezone name`,
			);
		expect(() => parse(['--nope', '--tz'], YEAR)).toThrow('--tz needs a value');
	});

	it('passes over a second --tz unread, as the crate does', () => {
		expect(parse(['--tz', 'UTC', '.', '--tz'], YEAR).roots).toEqual(['.']);
	});

	it('refuses what the crate refuses, in its words', () => {
		expect(() => parse(['--after', 'soon', '.'], YEAR)).toThrow(
			'"soon" is not a date this can read',
		);
		expect(() => parse(['--date-order', 'DMY', '.'], YEAR)).toThrow(
			'--date-order needs mdy or dmy, not "DMY"',
		);
		expect(() => parse(['--constructor', '.'], YEAR)).toThrow(
			'unknown option "--constructor"',
		);
		expect(() => parse(['--sort'], YEAR)).toThrow(
			'name a file or directory, or pass --stdin',
		);
		expect(parse(['constructor'], YEAR).roots).toEqual(['constructor']);
	});
});

describe('rustDebug', () => {
	it('quotes as str Debug does', () => {
		expect(rustDebug('a"b\\c\td\ne\r\0')).toBe('"a\\"b\\\\c\\td\\ne\\r\\0"');
		expect(rustDebug("it's é 🎯")).toBe('"it\'s é 🎯"');
		expect(rustDebug(' ​́\u0085')).toBe('"\\u{a0}\\u{200b}\\u{301}\\u{85}"');
	});
});

describe('toIso', () => {
	it("writes chrono's form: milliseconds only when there are some", () => {
		expect(toIso(1_705_314_645_000)).toBe('2024-01-15T10:30:45Z');
		expect(toIso(1_705_314_645_123)).toBe('2024-01-15T10:30:45.123Z');
	});

	it('signs a year outside 0 to 9999, and gives up past chrono', () => {
		expect(toIso(Date.UTC(10000, 0, 1))).toBe('+10000-01-01T00:00:00Z');
		expect(toIso(Date.UTC(-1, 0, 1))).toBe('-0001-01-01T00:00:00Z');
		expect(toIso(8_640_000_000_000_000)).toBeNull();
	});
});

describe('scanText', () => {
	it('writes a report in the crate field order', async () => {
		const report = await scanText(
			'a.md',
			'Cut on 2024-01-15T10:30:45Z.\n',
			'markdown',
			{
				...SCAN,
				iso: true,
			},
		);
		expect(JSON.stringify(report)).toBe(
			'{"file":"a.md","fileType":"markdown","dates":[{"value":"2024-01-15T10:30:45Z","format":"iso","timestamp":1705314645000,"line":1,"column":8,"iso":"2024-01-15T10:30:45Z"}]}',
		);
	});

	it('filters, then dedupes in document order, then sorts', async () => {
		const values = async (options: Partial<ScanOptions>) =>
			(
				await scanText(
					'x',
					'2024-03-01 then 2024-01-15 then 2024-01-15 then 2023-06-01',
					'plaintext',
					{ ...SCAN, ...options },
				)
			).dates.map((date) => date.value);
		expect(await values({ dedupe: true, sort: true })).toEqual([
			'2023-06-01',
			'2024-01-15',
			'2024-03-01',
		]);
		expect(
			await values({
				after: Date.UTC(2024, 0, 1),
				before: Date.UTC(2024, 2, 1),
			}),
		).toEqual(['2024-01-15', '2024-01-15']);
		expect(await values({ kinds: ['unix'] })).toEqual([]);
	});

	it('reads a syslog line in the year it is told', async () => {
		const report = await scanText('x', 'Jan 15 10:30:45 host app: ok', 'log', {
			...SCAN,
			year: 2020,
		});
		expect(new Date(report.dates[0]?.timestamp ?? 0).getUTCFullYear()).toBe(
			2020,
		);
	});
});

describe('exitCode', () => {
	const found = {
		file: 'a',
		fileType: 'log',
		dates: [{}],
	} as unknown as FileReport;
	const unread = {
		file: 'b',
		fileType: '',
		dates: [],
		skipped: 'x',
	} as FileReport;

	it('follows grep, and fails an unread file only under --strict', () => {
		expect(exitCode([found], false)).toBe(0);
		expect(exitCode([unread], false)).toBe(1);
		expect(exitCode([found, unread], true)).toBe(2);
	});
});

describe('describe', () => {
	it('carries the ISO string only when it was asked for', () => {
		const report = { file: 'a.md' } as FileReport;
		const date = {
			value: 'v',
			format: 'iso',
			timestamp: 0,
			line: 1,
			column: 2,
		};
		expect(line(report, date)).toBe('a.md:1:2  v  [iso]');
		expect(line(report, { ...date, iso: 'z' })).toBe('a.md:1:2  v  [iso]  z');
	});
});

describe('collect', () => {
	const root = mkdtempSync(join(tmpdir(), 'dates-le-walk-'));
	const files = [
		'a.md',
		'a b.md',
		'.hidden.md',
		'skip.md',
		'sub/c.md',
		'.ignore',
	];
	mkdirSync(join(root, 'sub'));
	for (const name of files)
		writeFileSync(join(root, name), name === '.ignore' ? 'skip.md\n' : '');

	afterAll(() => {
		for (const name of files) unlinkSync(join(root, name));
		rmdirSync(join(root, 'sub'));
		rmdirSync(root);
	});

	it('sorts by component, skips hidden files, and keeps .ignore under --no-ignore', () => {
		const shown = (hidden: boolean) =>
			collect([root], { hidden, respectIgnore: false }).map((path) =>
				path.slice(root.length + 1).replaceAll('\\', '/'),
			);
		expect(shown(false)).toEqual(['a b.md', 'a.md', 'sub/c.md']);
		expect(shown(true)).toEqual([
			'.hidden.md',
			'.ignore',
			'a b.md',
			'a.md',
			'sub/c.md',
		]);
	});

	it('reads a named file whatever it is called, once however often it is named', () => {
		const named = join(root, 'skip.md');
		expect(
			collect([named, named], { hidden: false, respectIgnore: true }),
		).toEqual([named]);
	});
});

describe('run', () => {
	const io = (input: string) => {
		const out: string[] = [];
		const err: string[] = [];
		return {
			out,
			err,
			io: {
				stdout: (text: string) => out.push(text),
				stderr: (text: string) => err.push(text),
				stdoutIsTerminal: false,
				readStdin: async () => Buffer.from(input),
				version: '9.9.9',
				year: YEAR,
			},
		};
	};

	it('reads stdin without its byte-order mark and lists what it found', async () => {
		const { out, err, io: streams } = io('﻿2024-01-15 at the start');
		expect(await run(['--stdin'], streams)).toBe(0);
		expect(JSON.parse(out.join('')).dates[0].column).toBe(1);
		expect(err.join('')).toBe(
			'<stdin>:1:1  2024-01-15  [simple]\n1 date in 1 file\n',
		);
	});

	it('refuses stdin that is not UTF-8, and points at --help', async () => {
		const streams = io('');
		streams.io = {
			...streams.io,
			readStdin: async () => Buffer.from([0x32, 0xff]),
		};
		expect(await run(['--stdin'], streams.io)).toBe(2);
		expect(streams.err.join('')).toBe(
			'dates-le: could not read stdin: stream did not contain valid UTF-8\ntry `dates-le --help`\n',
		);
	});

	it('answers --version wherever it appears', async () => {
		const { out, io: streams } = io('');
		expect(await run(['.', '--version'], streams)).toBe(0);
		expect(out.join('')).toBe('dates-le 9.9.9\n');
	});
});

describe('mcp', () => {
	const session = async (input: string | Buffer) => {
		const written: string[] = [];
		const code = await serve(
			Readable.from([Buffer.from(input)]),
			(line) => written.push(line),
			'9.9.9',
		);
		return { code, written };
	};

	it('writes keys in the order the crate builds them', async () => {
		const { written } = await session(
			'{"jsonrpc":"2.0","id":1,"method":"ping"}\n',
		);
		expect(written).toEqual(['{"jsonrpc":"2.0","id":1,"result":{}}\n']);
	});

	it('answers no notification and no frame that is not JSON, but answers a null id', async () => {
		const { written } = await session(
			'{"jsonrpc":"2.0","method":"ping"}\nnot json\n{"jsonrpc":"2.0","id":null,"method":"ping"}\n',
		);
		expect(written).toEqual(['{"jsonrpc":"2.0","id":null,"result":{}}\n']);
	});

	it('ends with exit 2 on a line that is not UTF-8', async () => {
		const { code } = await session(Buffer.from([0x7b, 0xff, 0x7d, 0x0a]));
		expect(code).toBe(2);
	});

	it('scans a missing path to an empty answer, as the crate walk does', async () => {
		const { written } = await session(
			`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'dates_le_scan', arguments: { path: join(tmpdir(), 'dates-le-no-such-path') } } })}\n`,
		);
		const reply = JSON.parse(written[0] ?? '{}');
		expect(reply.result.structuredContent.data).toEqual({
			reports: [],
			dates: 0,
		});
	});
});
