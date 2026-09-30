import type { DateValue } from '../../types';
import { scanDates } from '../heuristics';
import type { DateOrder } from '../regional';

export function extractFromCsv(
	content: string,
	order?: DateOrder,
): readonly DateValue[] {
	return scanDates(content, [], order);
}
