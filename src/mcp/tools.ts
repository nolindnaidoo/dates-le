import { extractDates } from '../extraction/extract';
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

	const format = typeof args.format === 'string' ? args.format : undefined;
	const filename =
		typeof args.filename === 'string' ? args.filename : undefined;

	// Requiring one of the two up front gives a message naming the problem.
	// Without it an unrecognised language returns an empty result with no
	// error, which reads as "this document has no dates".
	const languageId = resolveFormat(format, filename);
	if (!languageId) {
		throw new Error(
			`Provide \`format\` (one of: ${SUPPORTED_FORMATS.join(', ')}) or a \`filename\` with a recognised extension.`,
		);
	}

	const result = await extractDates(content, languageId);
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

export const TOOLS: readonly ToolDefinition[] = Object.freeze([
	Object.freeze({
		name: 'extract_dates',
		description:
			'Extract every date and timestamp from a document, with its notation, epoch value where resolvable, and 1-based line and column. Supports JSON, YAML, CSV, XML, log and plaintext, JavaScript, TypeScript and HTML. Recognises ISO 8601, RFC formats, common regional notations and Unix timestamps.',
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
						'Document format. Provide this or `filename`. Common extensions and aliases are accepted.',
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
				maxResults: MAX_RESULTS_SCHEMA,
			},
			required: ['content'],
			additionalProperties: false,
		},
		handler: extract,
	}),
]);
