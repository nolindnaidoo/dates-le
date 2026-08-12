/**
 * Resolving a format hint from whatever an agent happens to send.
 *
 * The engine's own `determineFileType` accepts VS Code language ids and nothing
 * else, so an agent sending `yml`, `.log`, `jsonc` or `app.log` needs widening,
 * and it happens here rather than in the engine, whose behaviour is pinned by
 * characterization goldens.
 *
 * A name nothing recognises resolves to `unknown` rather than to null. That is
 * not a guess: `unknown` routes to the patterns every format shares, which is
 * the correct reading of a `.py`, `.go`, `.toml` or `.md` file, and it is the
 * `fileType` the answer carries so the caller can see which patterns ran.
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
	// Read by the shared patterns like everything unnamed, and named all
	// the same: a caller who says `toml` should not be told `unknown` in
	// the answer's own `fileType` field.
	toml: 'toml',
	ini: 'ini',
	cfg: 'ini',
	conf: 'ini',
	properties: 'properties',
	markdown: 'markdown',
	md: 'markdown',
});

/** What a name nothing recognises resolves to. Held equal to the crate's. */
export const FALLBACK_FORMAT = 'unknown';

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
	'toml',
	'markdown',
]);

function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Resolve a language id from an explicit format, else from a filename,
 * else the fallback.
 */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): string {
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

	return FALLBACK_FORMAT;
}
