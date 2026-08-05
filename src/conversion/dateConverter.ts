import type { DateFormat, DateValue } from '../types';

export interface DateConversionOptions {
	readonly targetFormat: DateFormat;
	readonly timezone?: string;
	readonly locale?: string;
	readonly customFormat?: string;
}

export interface DateConversionResult {
	readonly original: DateValue;
	readonly converted: string;
	readonly format: DateFormat;
	readonly timestamp: number;
	readonly timezone: string | undefined;
	readonly locale: string | undefined;
}

/**
 * Convert a date value to a different format
 */
function convertDate(
	dateValue: DateValue,
	options: DateConversionOptions,
): DateConversionResult {
	if (!dateValue.timestamp) {
		throw new Error(
			`Cannot convert date without timestamp: ${dateValue.value}`,
		);
	}

	const date = new Date(dateValue.timestamp);
	let converted: string;
	let format: DateFormat = options.targetFormat;

	switch (options.targetFormat) {
		case 'iso':
			converted = date.toISOString();
			break;
		case 'rfc2822':
			converted = date.toUTCString();
			break;
		case 'unix':
			converted = Math.floor(date.getTime() / 1000).toString();
			break;
		case 'utc':
			converted = date.toUTCString();
			break;
		case 'local':
			converted = date.toString();
			break;
		case 'simple':
			converted = date.toISOString().split('T')[0] ?? '';
			break;
		case 'custom':
			// Without a custom format there is nothing to apply, so this falls
			// back to ISO and says so in the reported format.
			if (!options.customFormat) {
				converted = date.toISOString();
				format = 'iso';
				break;
			}
			converted = formatCustomDate(date, options.customFormat);
			break;
		default:
			converted = date.toISOString();
			format = 'iso';
	}

	return {
		original: dateValue,
		converted,
		format,
		timestamp: dateValue.timestamp,
		timezone: options.timezone,
		locale: options.locale,
	};
}

/**
 * Convert multiple dates to a target format, discarding any that fail.
 *
 * Callers that show a count to the user should use `convertDatesWithSkipped`
 * instead — see the note there.
 */
export function convertDates(
	dates: readonly DateValue[],
	options: DateConversionOptions,
): readonly DateConversionResult[] {
	const { results } = convertDatesWithSkipped(dates, options);
	return results;
}

/**
 * Convert multiple dates, reporting which ones could not be converted.
 *
 * Prefer this over `convertDates` where the count is shown to the user: a
 * silently shorter list reads as data loss.
 */
export function convertDatesWithSkipped(
	dates: readonly DateValue[],
	options: DateConversionOptions,
): { readonly results: DateConversionResult[]; readonly skipped: DateValue[] } {
	const skipped: DateValue[] = [];
	const results: DateConversionResult[] = [];

	for (const date of dates) {
		try {
			results.push(convertDate(date, options));
		} catch {
			skipped.push(date);
		}
	}

	return { results, skipped };
}

/**
 * Format date with custom format string
 */
function formatCustomDate(date: Date, format: string): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

	return format
		.replace(/YYYY/g, year.toString())
		.replace(/MM/g, month)
		.replace(/DD/g, day)
		.replace(/HH/g, hours)
		.replace(/mm/g, minutes)
		.replace(/ss/g, seconds)
		.replace(/SSS/g, milliseconds)
		.replace(/YY/g, year.toString().slice(-2))
		.replace(/M/g, (date.getMonth() + 1).toString())
		.replace(/D/g, date.getDate().toString())
		.replace(/H/g, date.getHours().toString())
		.replace(/m/g, date.getMinutes().toString())
		.replace(/s/g, date.getSeconds().toString());
}

/**
 * Get available date formats
 */
export function getAvailableFormats(): Array<{
	readonly format: DateFormat;
	readonly name: string;
	readonly description: string;
	readonly example: string;
}> {
	const now = new Date();

	return [
		{
			format: 'iso',
			name: 'ISO 8601',
			description: 'International standard format',
			example: now.toISOString(),
		},
		{
			format: 'rfc2822',
			name: 'RFC 2822',
			description: 'Email and HTTP standard',
			example: now.toUTCString(),
		},
		{
			format: 'unix',
			name: 'Unix Timestamp',
			description: 'Seconds since epoch',
			example: Math.floor(now.getTime() / 1000).toString(),
		},
		{
			format: 'utc',
			name: 'UTC String',
			description: 'UTC format string',
			example: now.toUTCString(),
		},
		{
			format: 'local',
			name: 'Local String',
			description: 'Local timezone format',
			example: now.toString(),
		},
		{
			format: 'simple',
			name: 'Simple Date',
			description: 'Date only (YYYY-MM-DD)',
			example: now.toISOString().split('T')[0] ?? '',
		},
		{
			format: 'custom',
			name: 'Custom Format',
			description: 'User-defined format',
			example: formatCustomDate(now, 'YYYY-MM-DD HH:mm:ss'),
		},
	];
}
