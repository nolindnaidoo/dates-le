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
export function convertDate(
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
 * Convert dates between timezones
 */
export function convertTimezone(
	dateValue: DateValue,
	targetTimezone: string,
): DateConversionResult {
	if (!dateValue.timestamp) {
		throw new Error(
			`Cannot convert timezone for date without timestamp: ${dateValue.value}`,
		);
	}

	const date = new Date(dateValue.timestamp);

	// For now, we'll use the browser's built-in timezone handling
	// In a real implementation, you might want to use a library like date-fns-tz
	const converted = date.toLocaleString('en-US', {
		timeZone: targetTimezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});

	return {
		original: dateValue,
		converted,
		format: 'custom',
		timestamp: dateValue.timestamp,
		timezone: targetTimezone,
		locale: undefined,
	};
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

/**
 * Get common timezones
 */
export function getCommonTimezones(): Array<{
	readonly code: string;
	readonly name: string;
	readonly offset: string;
}> {
	return [
		{ code: 'UTC', name: 'Coordinated Universal Time', offset: '+00:00' },
		{ code: 'America/New_York', name: 'Eastern Time', offset: '-05:00' },
		{ code: 'America/Chicago', name: 'Central Time', offset: '-06:00' },
		{ code: 'America/Denver', name: 'Mountain Time', offset: '-07:00' },
		{ code: 'America/Los_Angeles', name: 'Pacific Time', offset: '-08:00' },
		{ code: 'Europe/London', name: 'Greenwich Mean Time', offset: '+00:00' },
		{ code: 'Europe/Paris', name: 'Central European Time', offset: '+01:00' },
		{ code: 'Europe/Berlin', name: 'Central European Time', offset: '+01:00' },
		{ code: 'Asia/Tokyo', name: 'Japan Standard Time', offset: '+09:00' },
		{ code: 'Asia/Shanghai', name: 'China Standard Time', offset: '+08:00' },
		{ code: 'Asia/Kolkata', name: 'India Standard Time', offset: '+05:30' },
		{
			code: 'Australia/Sydney',
			name: 'Australian Eastern Time',
			offset: '+10:00',
		},
	];
}

/**
 * Validate date format string
 */
export function validateDateFormat(format: string): {
	readonly valid: boolean;
	readonly errors: string[];
} {
	const errors: string[] = [];

	// Check for invalid characters
	const invalidChars = format.match(/[^YMDHmsS\-\s:./]/g);
	if (invalidChars) {
		errors.push(`Invalid characters: ${invalidChars.join(', ')}`);
	}

	// Check for required components
	if (!format.includes('Y')) {
		errors.push('Format must include year (Y or YYYY)');
	}

	if (!format.includes('M')) {
		errors.push('Format must include month (M or MM)');
	}

	if (!format.includes('D')) {
		errors.push('Format must include day (D or DD)');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Get relative time string (e.g., "2 days ago", "in 3 hours")
 */
export function getRelativeTime(date: Date, now: Date = new Date()): string {
	const diff = now.getTime() - date.getTime();
	const seconds = Math.floor(Math.abs(diff) / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const weeks = Math.floor(days / 7);
	const months = Math.floor(days / 30);
	const years = Math.floor(days / 365);

	const isFuture = diff < 0;
	const prefix = isFuture ? 'in ' : '';
	const suffix = isFuture ? '' : ' ago';

	if (years > 0) {
		return `${prefix}${years} year${years === 1 ? '' : 's'}${suffix}`;
	}
	if (months > 0) {
		return `${prefix}${months} month${months === 1 ? '' : 's'}${suffix}`;
	}
	if (weeks > 0) {
		return `${prefix}${weeks} week${weeks === 1 ? '' : 's'}${suffix}`;
	}
	if (days > 0) {
		return `${prefix}${days} day${days === 1 ? '' : 's'}${suffix}`;
	}
	if (hours > 0) {
		return `${prefix}${hours} hour${hours === 1 ? '' : 's'}${suffix}`;
	}
	if (minutes > 0) {
		return `${prefix}${minutes} minute${minutes === 1 ? '' : 's'}${suffix}`;
	}
	if (seconds > 0) {
		return `${prefix}${seconds} second${seconds === 1 ? '' : 's'}${suffix}`;
	}

	return 'just now';
}

/**
 * Format date according to locale
 */
export function formatDateLocale(
	date: Date,
	locale: string = 'en-US',
	options: Intl.DateTimeFormatOptions = {},
): string {
	return date.toLocaleDateString(locale, options);
}

/**
 * Get date format from string (attempt to detect format)
 */
export function detectDateFormat(dateString: string): DateFormat | null {
	// ISO 8601
	if (
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(
			dateString,
		)
	) {
		return 'iso';
	}

	// RFC 2822
	if (
		/^[A-Za-z]{3},\s\d{2}\s[A-Za-z]{3}\s\d{4}\s\d{2}:\d{2}:\d{2}\s[A-Za-z]{3,4}$/.test(
			dateString,
		)
	) {
		return 'rfc2822';
	}

	// Unix timestamp
	if (/^\d{10,13}$/.test(dateString)) {
		return 'unix';
	}

	// Simple date
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
		return 'simple';
	}

	// Local format (MM/DD/YYYY or DD/MM/YYYY)
	if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
		return 'local';
	}

	return null;
}
