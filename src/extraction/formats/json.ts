import type { DateValue } from '../../types';
import { scanDates } from '../heuristics';

export function extractFromJson(content: string): DateValue[] {
	return scanDates(content);
}
