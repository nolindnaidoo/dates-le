/**
 * Resolving a format hint from whatever an agent happens to send.
 *
 * The engine's own `determineFileType` accepts VS Code language ids and nothing
 * else — anything it does not recognise returns `unknown`, and `extractDates`
 * then returns an empty result with no error, which is indistinguishable from a
 * document that genuinely has no dates. An agent will send `yml`, `.log`,
 * `jsonc` or `app.log` instead. Widening happens here rather than in the
 * engine, whose behaviour is pinned by characterization goldens.
 */

/** Every language id the engine understands, keyed by what a caller might send. */
const ALIASES: Readonly<Record<string, string>> = Object.freeze({
	json: 'json',
	jsonc: 'json',
	yaml: 'yaml',
	yml: 'yaml',
	csv: 'csv',
	tsv: 'csv',
	xml: 'xml',
	log: 'log',
	txt: 'plaintext',
	text: 'plaintext',
	plaintext: 'plaintext',
	javascript: 'javascript',
	js: 'javascript',
	jsx: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	javascriptreact: 'javascript',
	typescript: 'typescript',
	ts: 'typescript',
	tsx: 'typescript',
	mts: 'typescript',
	cts: 'typescript',
	typescriptreact: 'typescript',
	html: 'html',
	htm: 'html',
	xhtml: 'html',
});

/** The formats a caller can name, for the tool schema's enum. */
export const SUPPORTED_FORMATS: readonly string[] = Object.freeze([
	'json',
	'yaml',
	'csv',
	'xml',
	'log',
	'plaintext',
	'javascript',
	'typescript',
	'html',
]);

function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Resolve a language id from an explicit format, else from a filename.
 *
 * Returns null rather than guessing: a wrong format extracts nothing and looks
 * like a document with no dates, which is the least debuggable outcome for a
 * caller.
 */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): string | null {
	if (format) {
		const direct = ALIASES[normalise(format)];
		if (direct) return direct;
	}

	if (filename) {
		const extension = filename.includes('.')
			? filename.slice(filename.lastIndexOf('.') + 1)
			: '';
		const inferred = ALIASES[normalise(extension)];
		if (inferred) return inferred;
	}

	return null;
}
