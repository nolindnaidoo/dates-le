import type { DateValue } from '../../types';
import { type DatePatternSpec, scanDates } from '../heuristics';

/**
 * Log-specific patterns on top of the shared core:
 * - `YYYY-MM-DD HH:mm:ss(.SSS)` log timestamps (classified 'iso' — the
 *   space-separated form parses identically),
 * - syslog `Mon DD HH:mm:ss` (no year on the line; the current year is
 *   assumed — documented limitation),
 * - Apache access-log `[DD/Mon/YYYY:HH:mm:ss +0000]` (the value is the
 *   timestamp itself, without the brackets v1.x included).
 * Containment dedupe replaces the v1.x behavior of emitting both the
 * shared-core match and the log match for the same characters.
 */
const LOG_SPECS: readonly DatePatternSpec[] = [
	{
		pattern: /(?<!\d)\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?!\d)/dg,
		format: 'iso',
	},
	{
		pattern: /(?<![A-Za-z])[A-Za-z]{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}(?!\d)/dg,
		format: 'custom',
		toTimestamp: (value) => Date.parse(`${value} ${currentYear()}`),
	},
	{
		pattern: /\[(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s[+-]\d{4})\]/dg,
		format: 'custom',
		toTimestamp: apacheToTimestamp,
	},
];

export function extractFromLog(content: string): readonly DateValue[] {
	return scanDates(content, LOG_SPECS);
}

function currentYear(): number {
	return new Date().getFullYear();
}

/** `15/Jan/2024:10:30:08 +0000` → `15 Jan 2024 10:30:08 +0000` */
function apacheToTimestamp(value: string): number {
	return Date.parse(value.replace(/\//g, ' ').replace(':', ' '));
}
