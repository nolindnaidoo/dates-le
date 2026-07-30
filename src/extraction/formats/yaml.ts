import type { DateValue } from '../../types';
import { scanDates } from '../heuristics';

export function extractFromYaml(content: string): DateValue[] {
	return scanDates(content);
}
