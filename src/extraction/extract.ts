import type {
	DateValue,
	ExtractionResult,
	FileType,
	ParseError,
} from '../types';
import { extractFromCsv } from './formats/csv';
import { extractFromJson } from './formats/json';
import { extractFromYaml } from './formats/yaml';

export async function extractDates(
	content: string,
	languageId: string,
): Promise<ExtractionResult> {
	const fileType = determineFileType(languageId);
	const dates: DateValue[] = [];
	const errors: ParseError[] = [];

	try {
		switch (fileType) {
			case 'json':
				dates.push(...extractFromJson(content));
				break;
			case 'yaml':
			case 'yml':
				dates.push(...extractFromYaml(content));
				break;
			case 'csv':
				dates.push(...extractFromCsv(content));
				break;
			default:
				// Unsupported file type - return empty results
				break;
		}
	} catch (error) {
		errors.push({
			category: 'parsing' as const,
			severity: 'warning' as const,
			message: error instanceof Error ? error.message : 'Unknown parsing error',
			recoverable: true,
			recoveryAction: 'skip' as const,
			timestamp: Date.now(),
		});
	}

	return Object.freeze({
		success: errors.length === 0,
		dates: Object.freeze(dates),
		errors: Object.freeze(errors),
	});
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
		default:
			return 'unknown';
	}
}
