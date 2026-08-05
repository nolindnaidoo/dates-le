import type { DateValue } from '../../types';
import { type DatePatternSpec, scanDates } from '../heuristics';

/**
 * JS/TS-specific patterns: date strings passed to date constructors —
 * new Date(), Date.parse(), moment(), dayjs(), DateTime.fromISO().
 * Whole-content matching, so calls formatted across multiple lines are
 * matched (v1.x scanned per line and missed every one). When the inner
 * string is itself a recognized format (ISO et al) the shared core wins
 * at the same offsets and classifies it; these specs only surface
 * strings that ONLY a date-constructor context identifies (e.g.
 * `new Date('March 5, 2024')`). Unparseable arguments are rejected by
 * the Date.parse gate.
 */
const JS_SPECS: readonly DatePatternSpec[] = [
	{
		pattern: /\bnew\s+Date\s*\(\s*(['"`])([^'"`\n]+)\1\s*,?\s*\)/dg,
		format: 'custom',
	},
	{
		pattern: /\bDate\.parse\s*\(\s*(['"`])([^'"`\n]+)\1\s*,?\s*\)/dg,
		format: 'custom',
	},
	{
		pattern: /\bmoment\s*\(\s*(['"`])([^'"`\n]+)\1\s*,?\s*\)/dg,
		format: 'custom',
	},
	{
		pattern: /\bdayjs\s*\(\s*(['"`])([^'"`\n]+)\1\s*,?\s*\)/dg,
		format: 'custom',
	},
	{
		pattern: /\bDateTime\.fromISO\s*\(\s*(['"`])([^'"`\n]+)\1\s*,?\s*\)/dg,
		format: 'custom',
	},
];

export function extractFromJavaScript(content: string): readonly DateValue[] {
	return scanDates(content, JS_SPECS);
}
