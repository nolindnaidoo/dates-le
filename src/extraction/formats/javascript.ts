import type { DateFormat, DateValue } from '../../types';

// Regex patterns for different date formats in JavaScript/TypeScript files
const ISO_PATTERN =
	/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/g;
const RFC2822_PATTERN =
	/([A-Za-z]{3},\s\d{2}\s[A-Za-z]{3}\s\d{4}\s\d{2}:\d{2}:\d{2}\s[A-Za-z]{3,4})/g;
const UNIX_PATTERN = /(\d{10,13})/g;
const UTC_PATTERN =
	/([A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT[+-]\d{4})/g;
const LOCAL_PATTERN = /(\d{1,2}\/\d{1,2}\/\d{4}\s\d{1,2}:\d{2}:\d{2})/g;
const SIMPLE_DATE_PATTERN = /(\d{4}-\d{2}-\d{2})/g;

// JavaScript-specific patterns
const NEW_DATE_PATTERN = /new\s+Date\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const DATE_PARSE_PATTERN = /Date\.parse\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const MOMENT_PATTERN = /moment\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const DAYJS_PATTERN = /dayjs\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const LUXON_PATTERN = /DateTime\.fromISO\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

export function extractFromJavaScript(content: string): DateValue[] {
	const dates: DateValue[] = [];
	const lines = content.split('\n');

	lines.forEach((line, lineIndex) => {
		// Extract ISO dates
		let match;
		while ((match = ISO_PATTERN.exec(line)) !== null) {
			dates.push({
				value: match[0],
				format: 'iso' as DateFormat,
				timestamp: Date.parse(match[0]),
				position: { line: lineIndex + 1, column: match.index + 1 },
				context: line.trim(),
			});
		}

		// Extract RFC2822 dates
		while ((match = RFC2822_PATTERN.exec(line)) !== null) {
			dates.push({
				value: match[0],
				format: 'rfc2822' as DateFormat,
				timestamp: Date.parse(match[0]),
				position: { line: lineIndex + 1, column: match.index + 1 },
				context: line.trim(),
			});
		}

		// Extract Unix timestamps
		while ((match = UNIX_PATTERN.exec(line)) !== null) {
			const timestamp = parseInt(match[0], 10);
			// Support both 10-digit (seconds) and 13-digit (milliseconds) timestamps
			// Range: ~2001 to ~2286 (reasonable date range)
			const isValid =
				(timestamp > 1000000000 && timestamp < 9999999999) || // 10 digits (seconds)
				(timestamp > 1000000000000 && timestamp < 9999999999999); // 13 digits (milliseconds)

			if (isValid) {
				// Convert to milliseconds if needed
				const timestampMs =
					match[0].length === 10 ? timestamp * 1000 : timestamp;
				dates.push({
					value: match[0],
					format: 'unix' as DateFormat,
					timestamp: timestampMs,
					position: { line: lineIndex + 1, column: match.index + 1 },
					context: line.trim(),
				});
			}
		}

		// Extract UTC dates
		while ((match = UTC_PATTERN.exec(line)) !== null) {
			dates.push({
				value: match[0],
				format: 'utc' as DateFormat,
				timestamp: Date.parse(match[0]),
				position: { line: lineIndex + 1, column: match.index + 1 },
				context: line.trim(),
			});
		}

		// Extract local dates
		while ((match = LOCAL_PATTERN.exec(line)) !== null) {
			dates.push({
				value: match[0],
				format: 'local' as DateFormat,
				timestamp: Date.parse(match[0]),
				position: { line: lineIndex + 1, column: match.index + 1 },
				context: line.trim(),
			});
		}

		// Extract simple dates
		while ((match = SIMPLE_DATE_PATTERN.exec(line)) !== null) {
			dates.push({
				value: match[0],
				format: 'simple' as DateFormat,
				timestamp: Date.parse(match[0]),
				position: { line: lineIndex + 1, column: match.index + 1 },
				context: line.trim(),
			});
		}

		// Extract new Date() constructor calls
		while ((match = NEW_DATE_PATTERN.exec(line)) !== null) {
			const dateString = match[1];
			if (dateString) {
				const parsed = Date.parse(dateString);

				if (!Number.isNaN(parsed)) {
					dates.push({
						value: dateString,
						format: 'custom' as DateFormat,
						timestamp: parsed,
						position: { line: lineIndex + 1, column: match.index + 1 },
						context: line.trim(),
					});
				}
			}
		}

		// Extract Date.parse() calls
		while ((match = DATE_PARSE_PATTERN.exec(line)) !== null) {
			const dateString = match[1];
			if (dateString) {
				const parsed = Date.parse(dateString);

				if (!Number.isNaN(parsed)) {
					dates.push({
						value: dateString,
						format: 'custom' as DateFormat,
						timestamp: parsed,
						position: { line: lineIndex + 1, column: match.index + 1 },
						context: line.trim(),
					});
				}
			}
		}

		// Extract moment.js calls
		while ((match = MOMENT_PATTERN.exec(line)) !== null) {
			const dateString = match[1];
			if (dateString) {
				const parsed = Date.parse(dateString);

				if (!Number.isNaN(parsed)) {
					dates.push({
						value: dateString,
						format: 'custom' as DateFormat,
						timestamp: parsed,
						position: { line: lineIndex + 1, column: match.index + 1 },
						context: line.trim(),
					});
				}
			}
		}

		// Extract dayjs calls
		while ((match = DAYJS_PATTERN.exec(line)) !== null) {
			const dateString = match[1];
			if (dateString) {
				const parsed = Date.parse(dateString);

				if (!Number.isNaN(parsed)) {
					dates.push({
						value: dateString,
						format: 'custom' as DateFormat,
						timestamp: parsed,
						position: { line: lineIndex + 1, column: match.index + 1 },
						context: line.trim(),
					});
				}
			}
		}

		// Extract Luxon DateTime calls
		while ((match = LUXON_PATTERN.exec(line)) !== null) {
			const dateString = match[1];
			if (dateString) {
				const parsed = Date.parse(dateString);

				if (!Number.isNaN(parsed)) {
					dates.push({
						value: dateString,
						format: 'custom' as DateFormat,
						timestamp: parsed,
						position: { line: lineIndex + 1, column: match.index + 1 },
						context: line.trim(),
					});
				}
			}
		}
	});

	return dates;
}
