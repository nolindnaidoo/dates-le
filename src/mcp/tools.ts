import { extractDates } from '../extraction/extract';
import { DATE_KINDS, DEFAULT_KINDS, isDateKind } from '../extraction/kinds';
import {
	type DateOrder,
	DEFAULT_DATE_ORDER,
	isDateOrder,
} from '../extraction/regional';
import type { DateFormat } from '../types';
import {
	capped,
	DEFAULT_MAX_RESULTS,
	envelope,
	MAX_MAX_RESULTS,
	readMaxResults,
	readString,
	toDiagnostics,
} from './envelope';
import { resolveFormat, SUPPORTED_FORMATS } from './fileType';
import type { ToolDefinition } from './transport';

/**
 * The tools this server exposes.
 *
 * Names are a public API with no deprecation channel — once an agent's prompt
 * or memory references `extract_dates`, renaming it breaks silently. They are
 * pinned by a golden test for that reason.
 *
 * No tool touches the filesystem. The agent already has file-read tools;
 * duplicating them here would add a path-traversal surface for no capability.
 *
 * **The description is the API.** A model reads it to decide whether to call
 * this tool at all, so it states plainly what the tool handles rather than
 * gesturing at "many formats" — a model cannot reason about a vague claim, and
 * the cost is either a call that returns nothing or a tool never tried. The
 * same reasoning governs argument descriptions: each says what the value does,
 * not what type it is, because the type is already in the schema.
 */

// Advertised in the schema with its default visible, rather than silently
// enforced. A model that can see the cap can raise it when it genuinely needs
// more, and can read `meta.truncated` to know it should. A hidden cap just
// produces quietly incomplete answers.
const MAX_RESULTS_SCHEMA = {
	type: 'integer',
	minimum: 1,
	maximum: MAX_MAX_RESULTS,
	default: DEFAULT_MAX_RESULTS,
	description: `Cap on returned dates (default ${DEFAULT_MAX_RESULTS}). meta.truncated reports whether any were dropped.`,
};

async function extract(args: Record<string, unknown>): Promise<unknown> {
	const content = readString(args, 'content');
	const maxResults = readMaxResults(args);
	const order = readDateOrder(args);
	const kinds = readKinds(args);

	const format = typeof args.format === 'string' ? args.format : undefined;
	const filename =
		typeof args.filename === 'string' ? args.filename : undefined;

	// Never a refusal. An agent that knows nothing about a document still
	// gets its dates, and `fileType` in the answer says which patterns
	// read it — so an unrecognised format is visible in the result rather
	// than hidden behind an error the agent has no way to satisfy.
	const languageId = resolveFormat(format, filename);
	const result = await extractDates(content, languageId, order, kinds);
	const values = result.dates.map((date) => ({
		value: date.value,
		format: date.format,
		timestamp: date.timestamp,
		timezone: date.timezone,
		line: date.position?.line,
		column: date.position?.column,
	}));

	const deduped =
		args.dedupe === true
			? values.filter(
					(date, i, all) =>
						all.findIndex((other) => other.value === date.value) === i,
				)
			: values;

	const { items, truncated } = capped(deduped, maxResults);

	return envelope(
		'extract_dates',
		{ dates: items, fileType: languageId },
		items.length,
		toDiagnostics(result),
		truncated,
	);
}

/**
 * Absent is the default. Anything that is not a list of kinds is refused: a
 * misspelt kind read as "no such kind" would return fewer dates than were
 * asked for and say nothing.
 */
function readKinds(args: Record<string, unknown>): readonly DateFormat[] {
	const raw = args.kinds;
	if (raw === undefined) return DEFAULT_KINDS;
	if (!Array.isArray(raw) || !raw.every(isDateKind)) {
		throw new Error(`kinds must be a list of: ${DATE_KINDS.join(', ')}`);
	}
	return raw;
}

/** Absent is the default; anything else that is not an order is refused. */
function readDateOrder(args: Record<string, unknown>): DateOrder {
	const raw = args.dateOrder;
	if (raw === undefined) return DEFAULT_DATE_ORDER;
	if (!isDateOrder(raw)) {
		throw new Error('dateOrder must be "mdy" or "dmy"');
	}
	return raw;
}

export const TOOLS: readonly ToolDefinition[] = Object.freeze([
	Object.freeze({
		name: 'extract_dates',
		description:
			'Extract every date and timestamp from a document, with its notation, epoch value where resolvable, and 1-based line and column. Reads any text: JSON, YAML, CSV, XML, log and plaintext, JavaScript, TypeScript, HTML, TOML and Markdown are named formats, and anything else is scanned with the patterns they share. Recognises ISO 8601 in extended, basic, week and ordinal form, RFC formats, day-first and month-first numeric dates, dates with the month written out, and, when `kinds` includes "unix", Unix timestamps from seconds to nanoseconds.',
		inputSchema: {
			type: 'object',
			properties: {
				content: {
					type: 'string',
					description: 'The document text to scan.',
				},
				format: {
					type: 'string',
					enum: SUPPORTED_FORMATS,
					description:
						'Document format. Common extensions and aliases are accepted. Optional: with neither this nor `filename` the document is scanned with the shared patterns.',
				},
				filename: {
					type: 'string',
					description:
						'Filename used to infer the format when `format` is absent, e.g. "app.log".',
				},
				dedupe: {
					type: 'boolean',
					default: false,
					description: 'Collapse repeated dates to their first occurrence.',
				},
				dateOrder: {
					type: 'string',
					enum: ['mdy', 'dmy'],
					default: DEFAULT_DATE_ORDER,
					description:
						'How to read a numeric date whose day and month could be either way round, such as 05/01/2024: "mdy" is 1 May, "dmy" is 5 January. A date that can only be read one way, such as 15/01/2024, is read that way regardless, and dotted dates such as 05.01.2024 are always day first.',
				},
				kinds: {
					type: 'array',
					items: { type: 'string', enum: DATE_KINDS },
					default: DEFAULT_KINDS,
					description:
						'The kinds of date to return, by the name each carries as `format` in the answer. Defaults to every kind except "unix": a bare number such as 1705314645 is only read as a date when "unix" is listed.',
				},
				maxResults: MAX_RESULTS_SCHEMA,
			},
			required: ['content'],
			additionalProperties: false,
		},
		handler: extract,
	}),
]);
