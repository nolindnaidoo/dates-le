import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { ExtractionResult } from '../types';
import { capped, isOk, readMaxResults, toDiagnostics } from './envelope';
import { resolveFormat, SUPPORTED_FORMATS } from './fileType';
import { TOOLS } from './tools';
import { createResponder, serve } from './transport';

/**
 * The MCP layer: the normalisation boundary, the tool table and the protocol.
 *
 * The engine is covered by its own characterization goldens. What is new here
 * is the translation between an agent's request and that engine — which is
 * where the interesting mistakes live: reporting a true empty result as a
 * failure, losing a severity the envelope has no slot for, letting an unbounded
 * extraction flood a context window, or renaming a tool something depends on.
 */

const emptyResult: ExtractionResult = Object.freeze({
	success: false,
	dates: Object.freeze([]),
	errors: Object.freeze([]),
});

const error = (severity: 'warning' | 'error' | 'critical') => ({
	...emptyResult,
	errors: [
		{
			category: 'parsing' as const,
			severity,
			message: 'bad',
			recoverable: false,
			recoveryAction: 'skip' as const,
			timestamp: 0,
		},
	],
});

describe('envelope: ok vs success', () => {
	it('treats an empty result with no errors as ok', () => {
		// extractDates returns success:false for an unknown language. Passing that
		// through as a failure would have a model announce a problem that did not
		// happen.
		expect(isOk(toDiagnostics(emptyResult))).toBe(true);
	});

	it('is not ok when the engine reported an error', () => {
		expect(isOk(toDiagnostics(error('error')))).toBe(false);
	});

	it('collapses critical upward into error, never into a warning', () => {
		// The engine has three severities and a diagnostic has two. Collapsing the
		// wrong way would report the worst case as the mildest one.
		const diagnostics = toDiagnostics(error('critical'));
		expect(diagnostics[0]?.severity).toBe('error');
		expect(isOk(diagnostics)).toBe(false);
	});

	it('stays ok when the engine only warned', () => {
		expect(isOk(toDiagnostics(error('warning')))).toBe(true);
	});
});

describe('envelope: result cap', () => {
	it('reports truncation honestly when it drops items', () => {
		const { items, truncated } = capped([1, 2, 3, 4, 5], 2);
		expect(items).toEqual([1, 2]);
		expect(truncated).toBe(true);
	});

	it('does not claim truncation when everything fits', () => {
		const { items, truncated } = capped([1, 2], 5);
		expect(items).toHaveLength(2);
		expect(truncated).toBe(false);
	});

	it('rejects a maxResults a tool cannot honour', () => {
		expect(() => readMaxResults({ maxResults: 0 })).toThrow(/positive integer/);
		expect(() => readMaxResults({ maxResults: 1.5 })).toThrow();
		expect(() => readMaxResults({ maxResults: 'ten' })).toThrow();
	});

	it('clamps an oversized request rather than refusing it', () => {
		expect(readMaxResults({ maxResults: 999999 })).toBe(5000);
	});
});

describe('fileType: tolerant resolution', () => {
	it('accepts the language ids the engine already knows', () => {
		expect(resolveFormat('json', undefined)).toBe('json');
	});

	it('accepts the shorthands an agent actually sends', () => {
		expect(resolveFormat('yml', undefined)).toBe('yaml');
		expect(resolveFormat('.JSONC', undefined)).toBe('json');
		expect(resolveFormat(' tsx ', undefined)).toBe('typescript');
	});

	it('infers from a filename when no format is given', () => {
		expect(resolveFormat(undefined, 'app.log')).toBe('log');
		expect(resolveFormat(undefined, 'data.csv')).toBe('csv');
	});

	it('falls back rather than refusing when neither input resolves', () => {
		expect(resolveFormat('klingon', 'a.klingon')).toBe('unknown');
		expect(resolveFormat(undefined, undefined)).toBe('unknown');
	});

	it('accepts the configuration and prose names', () => {
		expect(resolveFormat(undefined, 'pyproject.toml')).toBe('toml');
		expect(resolveFormat(undefined, 'README.md')).toBe('markdown');
		expect(resolveFormat('conf', undefined)).toBe('ini');
	});

	it('advertises only formats the engine supports', () => {
		expect(SUPPORTED_FORMATS).toContain('json');
		expect(SUPPORTED_FORMATS).not.toContain('unknown');
	});
});

describe('tool table', () => {
	it('pins the tool names', () => {
		// Tool names are a public API with no deprecation channel.
		expect(TOOLS.map((t) => t.name)).toEqual(['extract_dates']);
	});

	it('gives every tool a description and a closed schema', () => {
		for (const tool of TOOLS) {
			expect(tool.description.length).toBeGreaterThan(20);
			expect(tool.inputSchema.type).toBe('object');
			expect(tool.inputSchema.additionalProperties).toBe(false);
			expect(typeof tool.handler).toBe('function');
		}
	});

	it('caps results by default rather than leaving it unbounded', () => {
		const schema = TOOLS[0]?.inputSchema as {
			properties: { maxResults: { default: number } };
		};
		expect(schema.properties.maxResults.default).toBe(500);
	});
});

describe('extract_dates', () => {
	const call = async (args: Record<string, unknown>) => {
		const tool = TOOLS[0];
		if (!tool) throw new Error('no tool');
		return (await tool.handler(args)) as {
			ok: boolean;
			data: { dates: { value: string; line?: number }[] };
			meta: { count: number; truncated: boolean };
		};
	};

	it('extracts with positions', async () => {
		const result = await call({
			content: '{"created": "2024-03-15T08:30:00Z"}',
			format: 'json',
		});
		expect(result.data.dates[0]?.value).toBe('2024-03-15T08:30:00Z');
		expect(result.data.dates[0]?.line).toBe(1);
		expect(result.ok).toBe(true);
	});

	it('collapses repeats only when asked', async () => {
		const content = '{"a": "2024-03-15", "b": "2024-03-15"}';
		const kept = await call({ content, format: 'json' });
		const deduped = await call({ content, format: 'json', dedupe: true });
		expect(kept.meta.count).toBe(2);
		expect(deduped.meta.count).toBe(1);
	});

	it('truncates at maxResults and says so', async () => {
		const content = JSON.stringify(
			Object.fromEntries(
				Array.from({ length: 10 }, (_, i) => [
					`k${i}`,
					`2024-03-${String(i + 10).padStart(2, '0')}`,
				]),
			),
		);
		const result = await call({ content, format: 'json', maxResults: 3 });
		expect(result.meta.count).toBe(3);
		expect(result.meta.truncated).toBe(true);
	});

	it('reads the document when no format is given at all', async () => {
		// Refusing here made the tool unusable on the documents an agent
		// most often has: a source file whose language it cannot name.
		const result = await call({ content: '2024-03-15' });
		expect(result.data.dates[0]?.value).toBe('2024-03-15');
		expect(result.ok).toBe(true);
	});

	it('requires content', async () => {
		await expect(call({ format: 'json' })).rejects.toThrow(
			/content is required/,
		);
	});
});

describe('protocol', () => {
	const respond = createResponder(
		{ name: 'dates-le', version: '1.0.0' },
		TOOLS,
	);

	it('echoes the protocol version the client asked for', async () => {
		const reply = await respond({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: { protocolVersion: '2024-11-05' },
		});
		expect(reply?.result?.protocolVersion).toBe('2024-11-05');
		expect(reply?.result?.serverInfo).toEqual({
			name: 'dates-le',
			version: '1.0.0',
		});
	});

	it('does not reply to a notification', async () => {
		// A reply to a notification is the classic way to wedge a client.
		expect(
			await respond({ jsonrpc: '2.0', method: 'notifications/initialized' }),
		).toBeNull();
	});

	it('reports an unknown method as a JSON-RPC error', async () => {
		const reply = await respond({ jsonrpc: '2.0', id: 2, method: 'nope' });
		expect(reply?.error?.code).toBe(-32601);
	});

	it('reports an unknown tool without killing the connection', async () => {
		const reply = await respond({
			jsonrpc: '2.0',
			id: 3,
			method: 'tools/call',
			params: { name: 'no_such_tool', arguments: {} },
		});
		expect(reply?.error?.code).toBe(-32602);
	});

	it('returns a tool failure as a result, not a protocol error', async () => {
		// A model can read an isError result and correct itself; a JSON-RPC error
		// reads as "the server is broken".
		const reply = await respond({
			jsonrpc: '2.0',
			id: 4,
			method: 'tools/call',
			params: { name: 'extract_dates', arguments: {} },
		});
		expect(reply?.error).toBeUndefined();
		expect(reply?.result?.isError).toBe(true);
	});
});

describe('serve: the stdio loop', () => {
	/** A fake stdin/stdout pair so the loop can be driven without a process. */
	function harness() {
		const input = new EventEmitter() as EventEmitter & {
			setEncoding?: (e: string) => void;
		};
		const written: string[] = [];
		const output = {
			write: (chunk: string) => {
				written.push(chunk);
				return true;
			},
		};
		serve(
			{ name: 'dates-le', version: '1.0.0' },
			TOOLS,
			input as never,
			output as never,
		);
		const replies = () =>
			written
				.join('')
				.split('\n')
				.filter(Boolean)
				.map((l) => JSON.parse(l));
		return { input, replies };
	}

	const settle = () => new Promise((r) => setTimeout(r, 20));

	it('answers a request delivered as one line', async () => {
		const { input, replies } = harness();
		input.emit('data', '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
		await settle();
		expect(replies()[0]?.result?.tools).toHaveLength(1);
	});

	it('reassembles a request split across chunks', async () => {
		// stdin delivers whatever the OS gives it; a request arriving in two
		// pieces must not be dropped or double-parsed.
		const { input, replies } = harness();
		input.emit('data', '{"jsonrpc":"2.0","id":2,"me');
		input.emit('data', 'thod":"ping"}\n');
		await settle();
		expect(replies()[0]?.id).toBe(2);
	});

	it('handles several requests in one chunk', async () => {
		const { input, replies } = harness();
		input.emit(
			'data',
			'{"jsonrpc":"2.0","id":3,"method":"ping"}\n{"jsonrpc":"2.0","id":4,"method":"ping"}\n',
		);
		await settle();
		expect(replies().map((r) => r.id)).toEqual([3, 4]);
	});

	it('reports malformed JSON without dying', async () => {
		// One bad line from a client must not take the server down for everyone.
		const { input, replies } = harness();
		input.emit('data', 'not json at all\n');
		input.emit('data', '{"jsonrpc":"2.0","id":5,"method":"ping"}\n');
		await settle();
		expect(replies()[0]?.error?.code).toBe(-32700);
		expect(replies()[1]?.id).toBe(5);
	});

	it('rejects a payload that is not a JSON-RPC request', async () => {
		const { input, replies } = harness();
		input.emit('data', '{"hello":"world"}\n');
		await settle();
		expect(replies()[0]?.error?.code).toBe(-32700);
	});

	it('ignores blank lines', async () => {
		const { input, replies } = harness();
		input.emit('data', '\n\n{"jsonrpc":"2.0","id":6,"method":"ping"}\n');
		await settle();
		expect(replies()).toHaveLength(1);
	});

	it('writes nothing for a notification', async () => {
		const { input, replies } = harness();
		input.emit(
			'data',
			'{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
		);
		await settle();
		expect(replies()).toHaveLength(0);
	});
});
