import type { DateValue } from '../../types';
import { scanDates } from '../heuristics';

export function extractFromCsv(content: string): readonly DateValue[] {
	return scanDates(content);
}
