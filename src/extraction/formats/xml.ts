import type { DateValue } from '../../types';
import { scanDates } from '../heuristics';
import type { DateOrder } from '../regional';

/**
 * XML comments are masked (not removed) before scanning, so dates inside
 * any comment — leading, inline, or multiline — are skipped without
 * shifting the offsets of everything after them. v1.x dropped whole
 * lines that *started* with a comment, which both missed inline comments
 * and misreported every subsequent line number by the number of comment
 * lines above it.
 */
export function extractFromXml(
	content: string,
	order?: DateOrder,
): readonly DateValue[] {
	return scanDates(maskXmlComments(content), [], order);
}

function maskXmlComments(content: string): string {
	return content.replace(/<!--[\s\S]*?-->/g, (comment) =>
		comment.replace(/[^\n]/g, ' '),
	);
}
