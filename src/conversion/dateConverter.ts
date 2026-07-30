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
			converted = date.toISOString().split('T')[0]!;
			break;
		case 'custom':
			if (options.customFormat) {
				converted = formatCustomDate(date, options.customFormat);
			} else {
				converted = date.toISOString();
				format = 'iso';
			}
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
 * Convert multiple dates to a target format
 */
export function convertDates(
	dates: readonly DateValue[],
	options: DateConversionOptions,
): DateConversionResult[] {
	const results: DateConversionResult[] = [];

	for (const date of dates) {
		try {
			const result = convertDate(date, options);
			results.push(result);
		} catch (error) {
			// Skip dates that can't be converted
			console.warn(`Failed to convert date ${date.value}:`, error);
		}
	}

	return results;
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
			format: 'iso' as DateFormat,
			name: 'ISO 8601',
			description: 'International standard format',
			example: now.toISOString(),
		},
		{
			format: 'rfc2822' as DateFormat,
			name: 'RFC 2822',
			description: 'Email and HTTP standard',
			example: now.toUTCString(),
		},
		{
			format: 'unix' as DateFormat,
			name: 'Unix Timestamp',
			description: 'Seconds since epoch',
			example: Math.floor(now.getTime() / 1000).toString(),
		},
		{
			format: 'utc' as DateFormat,
			name: 'UTC String',
			description: 'UTC format string',
			example: now.toUTCString(),
		},
		{
			format: 'local' as DateFormat,
			name: 'Local String',
			description: 'Local timezone format',
			example: now.toString(),
		},
		{
			format: 'simple' as DateFormat,
			name: 'Simple Date',
			description: 'Date only (YYYY-MM-DD)',
			example: now.toISOString().split('T')[0]!,
		},
		{
			format: 'custom' as DateFormat,
			name: 'Custom Format',
			description: 'User-defined format',
			example: formatCustomDate(now, 'YYYY-MM-DD HH:mm:ss'),
		},
	];
}
