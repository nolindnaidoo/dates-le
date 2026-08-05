import type { DateValue } from '../../types';
import { type DatePatternSpec, scanDates } from '../heuristics';

/**
 * HTML-specific patterns: datetime attributes (covers <time> and any
 * other element), date-bearing <meta> tags, and JSON-LD
 * datePublished/dateModified. Whole-content matching, so attributes in
 * multi-line tags are matched. v1.x additionally ran a <time>-specific
 * copy of the datetime pattern and no dedupe, emitting the same
 * attribute value up to four times; containment dedupe now yields one
 * value per occurrence, classified by the shared core when the string
 * is a recognized format.
 */
const HTML_SPECS: readonly DatePatternSpec[] = [
	{
		pattern: /\bdatetime\s*=\s*(['"`])([^'"`]+)\1/dgi,
		format: 'custom',
	},
	{
		pattern:
			/<meta[^>]*(?:property|name)\s*=\s*(['"`])(?:date|published|modified|created)\1[^>]*content\s*=\s*(['"`])([^'"`]+)\2/dgi,
		format: 'custom',
	},
	{
		pattern: /"date(?:Published|Modified)"\s*:\s*(['"`])([^'"`]+)\1/dgi,
		format: 'custom',
	},
];

export function extractFromHtml(content: string): readonly DateValue[] {
	return scanDates(content, HTML_SPECS);
}
