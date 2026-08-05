import type { DateValue } from '../../types';
import { scanDates } from '../heuristics';

export function extractFromJson(content: string): readonly DateValue[] {
	return scanDates(content);
}
