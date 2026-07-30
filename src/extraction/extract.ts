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

export async function extractDates(
	content: string,
	languageId: string,
): Promise<ExtractionResult> {
	const fileType = determineFileType(languageId);

	if (fileType === 'unknown') {
		return createEmptyResult();
	}

	try {
		const dates = extractByFileType(content, fileType);
		return createSuccessResult(dates);
	} catch (error) {
		return createErrorResult(error);
	}
}

function extractByFileType(content: string, fileType: FileType): DateValue[] {
	switch (fileType) {
		case 'json':
			return extractFromJson(content);
		case 'yaml':
			return extractFromYaml(content);
		case 'csv':
			return extractFromCsv(content);
		case 'xml':
			return extractFromXml(content);
		case 'log':
			return extractFromLog(content);
		case 'javascript':
			return extractFromJavaScript(content);
		case 'html':
			return extractFromHtml(content);
		default:
			return [];
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

function createEmptyResult(): ExtractionResult {
	return Object.freeze({
		success: true,
		dates: Object.freeze([]),
		errors: Object.freeze([]),
	});
}

function createSuccessResult(dates: DateValue[]): ExtractionResult {
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
