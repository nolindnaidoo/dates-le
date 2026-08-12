import type { DateFormat, DateValue } from '../types';
import {
	isoBasicFormat,
	isoOrdinalDate,
	isoWeekDate,
	resolveInstant,
} from './extended';
import { createPositionIndex } from './position';

/**
 * The single date-matching core shared by every format extractor.
 * v1.x had three divergent copies of the same six patterns (dateExtractor,
 * html, javascript) with divergent dedupe rules: html/js emitted the same
 * date up to four times, per-line loops missed multiline constructs, and
 * the unix pattern matched the first 13 digits inside any longer digit
 * run (IDs, phone numbers).
 *
 * Rules:
 * - Whole-content matching with the `d` flag; positions are real
 *   line/column derived from match offsets.
 * - Unix timestamps must be exactly 10 or 13 digits with no digit
 *   neighbors, and must land in a plausible epoch range (~2001–2286).
 * - Overlap dedupe is by offset containment: a match whose range lies
 *   inside another match's range is dropped (the ISO wins over the bare
 *   date inside it), but an identical string elsewhere on the line is a
 *   separate occurrence and survives — v1.x dropped any 'simple' date
 *   that was a substring of an ISO anywhere on the same line, deleting
 *   real cells in CSV rows.
 * - Values whose timestamp cannot be parsed are not emitted (v1.x
 *   emitted NaN timestamps for generic patterns).
 *
 * Known limitations, kept deliberately: M/D/YYYY 'local' dates assume US
 * ordering; syslog lines carry no year, so the current year is assumed.
 */

export interface DatePatternSpec {
	/** Regex with `d` and `g` flags. The date is the LAST capture group,
	 * or the whole match when there are no groups. */
	readonly pattern: RegExp;
	readonly format: DateFormat;
	/** Derives the epoch-milliseconds timestamp; return NaN to reject. */
	readonly toTimestamp?: (value: string) => number;
}

export const BASE_PATTERNS: readonly DatePatternSpec[] = [
	{
		pattern:
			/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?/dg,
		format: 'iso',
	},
	{
		pattern:
			/[A-Za-z]{3},\s\d{1,2}\s[A-Za-z]{3}\s\d{4}\s\d{2}:\d{2}:\d{2}\s[A-Za-z]{3,4}/dg,
		format: 'rfc2822',
	},
	{
		// Seconds, milliseconds, microseconds or nanoseconds. Longest
		// alternative first, so a 19-digit run is read whole rather than
		// as its first 16 digits.
		//
		// A decimal point counts as a digit in the lookbehind: the
		// fractional part of a float is a digit run of any length, and
		// once 16 of them are microseconds, `Z_95 = 1.6448536269514722`
		// in a real Python file is a timestamp in 2174.
		pattern: /(?<![\d.])(?:\d{19}|\d{16}|\d{13}|\d{10})(?!\d)/dg,
		format: 'unix',
		toTimestamp: unixToTimestamp,
	},
	{
		pattern:
			/[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT[+-]\d{4}/dg,
		format: 'utc',
	},
	{
		pattern: /(?<!\d)\d{1,2}\/\d{1,2}\/\d{4}\s\d{1,2}:\d{2}:\d{2}(?!\d)/dg,
		format: 'local',
	},
	{
		pattern: /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/dg,
		format: 'simple',
	},
	// The three ISO 8601 shapes Date.parse refuses. Last because spec
	// order breaks a tie at identical ranges, and none of them can
	// overlap the six above — a `W`, a three-digit tail and an
	// eight-digit run are each unreachable by the others.
	{
		pattern: /(?<!\d)\d{4}-W\d{2}(?:-[1-7])?(?!\d)/dg,
		format: 'week',
		toTimestamp: isoWeekDate,
	},
	{
		pattern: /(?<!\d)\d{4}-\d{3}(?!\d)/dg,
		format: 'ordinal',
		toTimestamp: isoOrdinalDate,
	},
	{
		// A decimal point counts as a digit for the same reason it does
		// in the epoch pattern: `0.20240115` is a float.
		pattern:
			/(?<![\d.])\d{8}(?:T\d{6}(?:\.\d{1,3})?(?:Z|[+-]\d{4}|[+-]\d{2})?)?(?!\d)/dg,
		format: 'basic',
		toTimestamp: isoBasicFormat,
	},
];

interface Candidate {
	readonly value: string;
	readonly format: DateFormat;
	readonly timestamp: number;
	readonly start: number;
	readonly end: number;
}

/**
 * Run the base patterns plus any format-specific specs over the whole
 * content and return position-annotated, containment-deduped values.
 * Specs are matched in order; at identical ranges the earlier spec wins,
 * so base classifications (iso) beat format-specific 'custom' wrappers.
 */
export function scanDates(
	content: string,
	extraSpecs: readonly DatePatternSpec[] = [],
): readonly DateValue[] {
	const candidates: Candidate[] = [];
	const specs = [...BASE_PATTERNS, ...extraSpecs];

	for (const spec of specs) {
		spec.pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = spec.pattern.exec(content)) !== null) {
			const groupIndex = match.length - 1;
			const value = match[groupIndex];
			const indices = match.indices?.[groupIndex];
			if (!value || !indices) continue;

			const timestamp = (spec.toTimestamp ?? resolveInstant)(value);
			if (Number.isNaN(timestamp)) continue;

			candidates.push({
				value,
				format: spec.format,
				timestamp,
				start: indices[0],
				end: indices[1],
			});
		}
	}

	return toDateValues(content, dedupeContained(candidates));
}

/**
 * Seconds, milliseconds, microseconds or nanoseconds.
 *
 * The finer units are truncated by CHARACTER, not divided: 19 digits do
 * not fit a double, so dividing one would round it — and the Rust CLI,
 * working in i64, would not. Taking the leading 13 digits is exact in
 * both.
 */
function unixToTimestamp(value: string): number {
	if (value.length === 10) {
		const raw = Number.parseInt(value, 10);
		return raw > 1_000_000_000 ? raw * 1000 : Number.NaN;
	}
	if (value.length === 13) {
		const raw = Number.parseInt(value, 10);
		return raw > 1_000_000_000_000 ? raw : Number.NaN;
	}
	if (value.length === 16 || value.length === 19) {
		const milliseconds = Number.parseInt(value.slice(0, 13), 10);
		return milliseconds > 1_000_000_000_000 ? milliseconds : Number.NaN;
	}
	return Number.NaN;
}

/**
 * Sort by (start asc, end desc, insertion order) and drop any candidate
 * whose [start, end) range is contained in an already-kept range.
 */
function dedupeContained(candidates: readonly Candidate[]): Candidate[] {
	const indexed = candidates.map((candidate, order) => ({
		candidate,
		order,
	}));
	indexed.sort(
		(a, b) =>
			a.candidate.start - b.candidate.start ||
			b.candidate.end - a.candidate.end ||
			a.order - b.order,
	);

	const kept: Candidate[] = [];
	let coveringEnd = -1;
	for (const { candidate } of indexed) {
		if (candidate.end <= coveringEnd) {
			continue;
		}
		kept.push(candidate);
		coveringEnd = Math.max(coveringEnd, candidate.end);
	}
	return kept;
}

function toDateValues(
	content: string,
	candidates: readonly Candidate[],
): DateValue[] {
	const toPosition = createPositionIndex(content);
	const lines = content.split('\n');

	return candidates.map((candidate) => {
		const position = toPosition(candidate.start);
		return Object.freeze({
			value: candidate.value,
			format: candidate.format,
			timestamp: candidate.timestamp,
			position,
			context: (lines[position.line - 1] ?? '').trim(),
		});
	});
}
