import type { DateValue } from '../../types';
import { scanDates } from '../heuristics';
import type { DateOrder } from '../regional';

export function extractFromYaml(
	content: string,
	order?: DateOrder,
): readonly DateValue[] {
	return scanDates(content, [], order);
}
