import type {
	DateValue,
	ExtractionResult,
	FileType,
	ParseError,
} from '../types';
import { extractFromCsv } from './formats/csv';
import { extractFromHtml } from './formats/html';
import { extractFromJavaScript } from './formats/javascript';
import { extractFromJson } from './formats/json';
import { extractFromLog } from './formats/log';
import { extractFromXml } from './formats/xml';
import { extractFromYaml } from './formats/yaml';
import { scanDates } from './heuristics';
import type { DateOrder } from './regional';

export async function extractDates(
	content: string,
	languageId: string,
	order?: DateOrder,
): Promise<ExtractionResult> {
	try {
		const dates = extractByFileType(
			content,
			determineFileType(languageId),
			order,
		);
		return createSuccessResult(dates);
	} catch (error) {
		return createErrorResult(error);
	}
}

/**
 * The same extraction with nothing to await, for a caller that reads many
 * files in a row. A document a reader throws on yields nothing here, as it
 * yields an error and no dates there.
 */
export function extractDatesFromText(
	content: string,
	languageId: string,
	order?: DateOrder,
): readonly DateValue[] {
	try {
		return extractByFileType(content, determineFileType(languageId), order);
	} catch {
		return [];
	}
}

/**
 * A format only ever ADDS patterns to the shared ones — log adds syslog
 * and Apache, JavaScript adds constructor arguments, HTML adds
 * attributes — so the shared scan is the right answer for a document
 * whose language nothing here recognises, and `unknown` routes to it.
 * Returning nothing was this extension declining to read Python, Go,
 * TOML and Markdown at all, and saying so in a way indistinguishable
 * from a file with no dates in it.
 */
function extractByFileType(
	content: string,
	fileType: FileType,
	order: DateOrder | undefined,
): readonly DateValue[] {
	switch (fileType) {
		case 'json':
			return extractFromJson(content, order);
		case 'yaml':
			return extractFromYaml(content, order);
		case 'csv':
			return extractFromCsv(content, order);
		case 'xml':
			return extractFromXml(content, order);
		case 'log':
			return extractFromLog(content, order);
		case 'javascript':
			return extractFromJavaScript(content, order);
		case 'html':
			return extractFromHtml(content, order);
		default:
			return scanDates(content, [], order);
	}
}

function determineFileType(languageId: string): FileType {
	switch (languageId) {
		case 'json':
			return 'json';
		case 'yaml':
		case 'yml':
			return 'yaml';
		case 'csv':
			return 'csv';
		case 'xml':
			return 'xml';
		case 'log':
		case 'plaintext':
			return 'log';
		case 'javascript':
		case 'javascriptreact':
		case 'typescript':
		case 'typescriptreact':
			return 'javascript';
		case 'html':
			return 'html';
		default:
			return 'unknown';
	}
}

function createSuccessResult(dates: readonly DateValue[]): ExtractionResult {
	return Object.freeze({
		success: true,
		dates: Object.freeze(dates),
		errors: Object.freeze([]),
	});
}

function createErrorResult(error: unknown): ExtractionResult {
	const parseError: ParseError = {
		category: 'parsing' as const,
		severity: 'warning' as const,
		message: error instanceof Error ? error.message : 'Unknown parsing error',
		recoverable: true,
		recoveryAction: 'skip' as const,
		timestamp: Date.now(),
	};

	return Object.freeze({
		success: false,
		dates: Object.freeze([]),
		errors: Object.freeze([parseError]),
	});
}
