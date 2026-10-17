/**
 * `dates-le mcp`: the crate's MCP server (`crate/src/mcp/`), not the
 * extension's. It offers `dates_le_scan` beside the shared `extract_dates`,
 * answers in the crate's words, and writes each reply's keys in the order the
 * crate builds them, since its `serde_json` preserves insertion order.
 */

import { resolveInstant } from '../extraction/extended';
import { DATE_KINDS, DEFAULT_KINDS } from '../extraction/kinds';
import { isDateOrder } from '../extraction/regional';
import { SUPPORTED_FORMATS } from '../mcp/fileType';
import { TOOLS } from '../mcp/tools';
import type { DateFormat } from '../types';
import type { ScanOptions } from './args';
import { rustDebug } from './debug';
import { scanWalked } from './scan';
import { collect } from './walk';

const PROTOCOL_VERSION = '2025-06-18';
const INVALID_PARAMS = -32602;
const METHOD_NOT_FOUND = -32601;

type Handled =
	| { readonly result: unknown }
	| { readonly error: { readonly code: number; readonly message: string } };

type Diagnostic = Readonly<{ severity: string; code: string; message: string }>;

const EXTRACT = sharedTool('extract_dates');

const SCAN_DEFINITION = {
	name: 'dates_le_scan',
	description:
		'Extract every date and timestamp from files or directories, with the file it came from, its notation, the instant it resolves to, and its line and column. Reads the filesystem; never writes to it. Every text file is read: a name that matches no format is scanned with the patterns every format shares. Files .gitignore excludes are skipped unless `ignored` says otherwise.',
	inputSchema: {
		type: 'object',
		properties: {
			path: { type: 'string', description: 'a file or directory to read' },
			paths: {
				type: 'array',
				items: { type: 'string' },
				description: 'several files or directories, instead of `path`',
			},
			format: {
				type: 'string',
				enum: SUPPORTED_FORMATS,
				description:
					'Force a format for every file instead of inferring one per file name. A name nothing recognises falls back to the shared patterns.',
			},
			after: {
				type: 'string',
				description:
					'Keep only dates at or after this instant. Accepts any notation this tool reads, e.g. "2024-01-15".',
			},
			before: {
				type: 'string',
				description: 'Keep only dates strictly before this instant.',
			},
			dateOrder: {
				type: 'string',
				enum: ['mdy', 'dmy'],
				default: 'mdy',
				description:
					'How to read a numeric date whose day and month could be either way round, such as 05/01/2024: "mdy" is 1 May, "dmy" is 5 January.',
			},
			kinds: {
				type: 'array',
				items: { type: 'string', enum: DATE_KINDS },
				description:
					'The kinds of date to report. Defaults to every kind except "unix": a bare number such as 1705314645 is only read as a date when "unix" is listed.',
			},
			sort: {
				type: 'boolean',
				default: false,
				description: 'Order by instant rather than by position in the file.',
			},
			dedupe: {
				type: 'boolean',
				default: false,
				description: 'Collapse repeated dates to their first occurrence.',
			},
			hidden: {
				type: 'boolean',
				default: false,
				description: 'Walk hidden files and directories too.',
			},
			ignored: {
				type: 'boolean',
				default: false,
				description: 'Walk files excluded by .gitignore too.',
			},
		},
	},
};

/** The shared tool is the extension's, definition and handler both. */
function sharedTool(name: string) {
	const tool = TOOLS.find((candidate) => candidate.name === name);
	if (!tool) throw new Error(`the extension offers no tool named ${name}`);
	return tool;
}

/**
 * Serves until stdin closes, one request at a time, in order. A line that is
 * not UTF-8 ends the server with exit 2, as `BufRead::lines` does.
 */
export async function serve(
	input: AsyncIterable<Uint8Array>,
	write: (line: string) => void,
	version: string,
): Promise<number> {
	for await (const line of lines(input)) {
		if (line === null) return 2;
		if (isRustBlank(line)) continue;
		let request: unknown;
		try {
			request = JSON.parse(line);
		} catch {
			// A frame that is not JSON has no id to answer against.
			continue;
		}
		const response = await handle(request, version);
		if (response !== undefined) write(`${response}\n`);
	}
	return 0;
}

/** Lines split on `\n` with one trailing `\r` dropped, or null for invalid UTF-8. */
async function* lines(
	input: AsyncIterable<Uint8Array>,
): AsyncGenerator<string | null> {
	const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
	let pending = Buffer.alloc(0);
	for await (const chunk of input) {
		pending = Buffer.concat([pending, chunk]);
		let newline = pending.indexOf(10);
		while (newline !== -1) {
			yield decodeLine(decoder, pending.subarray(0, newline));
			pending = pending.subarray(newline + 1);
			newline = pending.indexOf(10);
		}
	}
	if (pending.length > 0) yield decodeLine(decoder, pending);
}

function decodeLine(decoder: TextDecoder, bytes: Uint8Array): string | null {
	try {
		const line = decoder.decode(bytes);
		return line.endsWith('\r') ? line.slice(0, -1) : line;
	} catch {
		return null;
	}
}

/** Rust's `char::is_whitespace`, which `str::trim` strips. */
function isRustBlank(line: string): boolean {
	return /^[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/.test(
		line,
	);
}

function field(value: unknown, name: string): unknown {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}
	return Object.hasOwn(value, name)
		? (value as Record<string, unknown>)[name]
		: undefined;
}

async function handle(
	request: unknown,
	version: string,
): Promise<string | undefined> {
	const method = field(request, 'method');
	if (typeof method !== 'string') return undefined;
	const id = field(request, 'id');
	// A notification carries no id and gets no reply.
	if (id === undefined) return undefined;
	const handled = await dispatch(method, field(request, 'params'), version);
	return JSON.stringify({ jsonrpc: '2.0', id, ...handled });
}

async function dispatch(
	method: string,
	params: unknown,
	version: string,
): Promise<Handled> {
	if (method === 'initialize') {
		return {
			result: {
				protocolVersion: PROTOCOL_VERSION,
				capabilities: { tools: {} },
				serverInfo: { name: 'dates-le', version },
			},
		};
	}
	if (method === 'tools/list') {
		const shared = {
			name: EXTRACT.name,
			description: EXTRACT.description,
			inputSchema: EXTRACT.inputSchema,
		};
		return { result: { tools: [shared, SCAN_DEFINITION] } };
	}
	if (method === 'tools/call') return callTool(params);
	if (method === 'ping') return { result: {} };
	return {
		error: {
			code: METHOD_NOT_FOUND,
			message: `this server does not implement ${method}`,
		},
	};
}

/**
 * Protocol failures are JSON-RPC errors. A tool that fails on its arguments
 * returns a result carrying `isError`, so a model reads the reason rather than
 * concluding the server is broken.
 */
async function callTool(params: unknown): Promise<Handled> {
	if (params === undefined) {
		return {
			error: { code: INVALID_PARAMS, message: 'no tool call was supplied' },
		};
	}
	const name = field(params, 'name');
	if (typeof name !== 'string') {
		return {
			error: { code: INVALID_PARAMS, message: 'the tool call named no tool' },
		};
	}
	// serde_json answers `get` on anything but an object with nothing, so
	// arguments that are not an object read as an empty one.
	const raw = field(params, 'arguments');
	const args = isObject(raw) ? raw : {};
	if (name === 'extract_dates') {
		return { result: await outcome(() => EXTRACT.handler(args)) };
	}
	if (name === 'dates_le_scan')
		return { result: await outcome(() => scan(args)) };
	return {
		error: {
			code: INVALID_PARAMS,
			message: `this server offers no tool named ${name}`,
		},
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function outcome(tool: () => Promise<unknown>): Promise<unknown> {
	let envelope: unknown;
	try {
		envelope = await tool();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { content: [{ type: 'text', text: message }], isError: true };
	}
	return {
		content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
		structuredContent: envelope,
		isError: false,
	};
}

async function scan(args: Record<string, unknown>): Promise<unknown> {
	const inputs = requestedPaths(args);
	const flag = (name: string) => args[name] === true;
	const options: ScanOptions = {
		format: typeof args.format === 'string' ? args.format : null,
		dedupe: flag('dedupe'),
		sort: flag('sort'),
		iso: false,
		after: boundary(args, 'after'),
		before: boundary(args, 'before'),
		year: new Date().getFullYear(),
		order: dateOrder(args),
		kinds: kinds(args),
	};
	const walked = collect(inputs, {
		hidden: flag('hidden'),
		respectIgnore: !flag('ignored'),
	});
	const { reports, binary } = await scanWalked(walked, options);
	const dates = reports.reduce((sum, report) => sum + report.dates.length, 0);
	const diagnostics: Diagnostic[] = reports
		.filter((report) => report.skipped !== undefined)
		.map((report) =>
			warning(
				'skipped',
				`${report.file} was not read, so this scan does not cover it`,
			),
		);
	if (binary > 0) {
		diagnostics.push(
			warning('binary', `${binary} file(s) are not text and were not read`),
		);
	}
	return envelope(
		'dates_le_scan',
		{ reports, dates },
		reports.length,
		diagnostics,
	);
}

function requestedPaths(args: Record<string, unknown>): readonly string[] {
	if (typeof args.path === 'string') return [args.path];
	if (Array.isArray(args.paths)) {
		const paths = args.paths.filter(
			(item): item is string => typeof item === 'string',
		);
		if (paths.length === 0) throw new Error('the list of paths was empty');
		return paths;
	}
	throw new Error('no file or directory was supplied to read');
}

function boundary(args: Record<string, unknown>, name: string): number | null {
	const raw = args[name];
	if (typeof raw !== 'string') return null;
	const parsed = resolveInstant(raw);
	if (Number.isNaN(parsed)) {
		throw new Error(
			`\`${name}\` is not a date this can read: ${rustDebug(raw)}`,
		);
	}
	return parsed;
}

function dateOrder(args: Record<string, unknown>) {
	if (!Object.hasOwn(args, 'dateOrder')) return 'mdy' as const;
	const raw = args.dateOrder;
	if (!isDateOrder(raw)) throw new Error('dateOrder must be "mdy" or "dmy"');
	return raw;
}

function kinds(args: Record<string, unknown>): readonly DateFormat[] {
	if (!Object.hasOwn(args, 'kinds')) return DEFAULT_KINDS;
	const raw = args.kinds;
	if (
		!Array.isArray(raw) ||
		!raw.every((kind) => DATE_KINDS.includes(kind as DateFormat))
	) {
		throw new Error(`kinds must be a list of: ${DATE_KINDS.join(', ')}`);
	}
	return raw as DateFormat[];
}

function warning(code: string, message: string): Diagnostic {
	return { severity: 'warning', code, message };
}

/** The one result shape every tool returns: `{ ok, data, diagnostics, meta }`. */
function envelope(
	tool: string,
	data: unknown,
	count: number,
	diagnostics: readonly Diagnostic[],
): unknown {
	return {
		ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
		data,
		diagnostics,
		meta: { tool, count, truncated: false },
	};
}
