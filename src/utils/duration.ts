/**
 * Human-readable rendering of a span between two dates.
 *
 * There were two implementations of this before, under the same name and the
 * same `(milliseconds: number) => string` signature, and both were wrong for
 * part of the range they were being handed:
 *
 *   - The one in `analysis/statistics.ts` only ever emitted days or hours, so
 *     a 45-minute gap read "0 hour" — mispluralised as well as useless.
 *   - The one in `commands/analyze.ts` topped out at hours, so a full year of
 *     dates rendered as "8760.00h" instead of "365 days".
 *
 * Both fed the same analysis report, which meant one gap could be described as
 * "Gap of 3 days" on one line and "Duration: 72.00h" on the next. This covers
 * the whole range with one set of rules so the report cannot contradict
 * itself.
 *
 * The output is report content and stays English deliberately — the generated
 * report is an artifact users save and share, and the extraction goldens pin
 * it. See the localization notes in CLAUDE.md.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(value: number, unit: string): string {
	return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

export function formatDateSpan(milliseconds: number): string {
	// Negative spans would come from unsorted input; report the magnitude
	// rather than "-3 days", which reads as a bug to the user either way.
	const ms = Math.abs(milliseconds);

	if (ms < SECOND) return plural(Math.round(ms), 'millisecond');
	if (ms < MINUTE) return plural(Math.round(ms / SECOND), 'second');
	if (ms < HOUR) return plural(Math.round(ms / MINUTE), 'minute');
	if (ms < DAY) return plural(Math.round(ms / HOUR), 'hour');
	return plural(Math.round(ms / DAY), 'day');
}
