import type { DateValue } from '../types';

export type SortMode = 'chronological' | 'reverse-chronological' | 'frequency';

export function sortDates(dates: DateValue[], mode: SortMode): DateValue[] {
	if (dates.length === 0) {
		return dates;
	}

	switch (mode) {
		case 'chronological':
			return [...dates].sort((a, b) => {
				const dateA = new Date(a.value).getTime();
				const dateB = new Date(b.value).getTime();
				return dateA - dateB;
			});

		case 'reverse-chronological':
			return [...dates].sort((a, b) => {
				const dateA = new Date(a.value).getTime();
				const dateB = new Date(b.value).getTime();
				return dateB - dateA;
			});

		case 'frequency': {
			// Count frequency of each date value
			const frequencyMap = new Map<string, number>();
			dates.forEach((date) => {
				const count = frequencyMap.get(date.value) || 0;
				frequencyMap.set(date.value, count + 1);
			});

			return [...dates].sort((a, b) => {
				const freqA = frequencyMap.get(a.value) || 0;
				const freqB = frequencyMap.get(b.value) || 0;
				return freqB - freqA;
			});
		}

		default:
			return dates;
	}
}

export function sortDatesByFormat(dates: DateValue[]): DateValue[] {
	if (dates.length === 0) {
		return dates;
	}

	const formatOrder = ['iso', 'rfc2822', 'unix', 'simple', 'custom'];

	return [...dates].sort((a, b) => {
		const indexA = formatOrder.indexOf(a.format);
		const indexB = formatOrder.indexOf(b.format);

		if (indexA === -1 && indexB === -1) {
			return 0;
		}
		if (indexA === -1) {
			return 1;
		}
		if (indexB === -1) {
			return -1;
		}

		return indexA - indexB;
	});
}

export function sortDatesByPosition(dates: DateValue[]): DateValue[] {
	if (dates.length === 0) {
		return dates;
	}

	return [...dates].sort((a, b) => {
		if (!a.position || !b.position) {
			return 0;
		}
		if (a.position.line !== b.position.line) {
			return a.position.line - b.position.line;
		}
		return a.position.column - b.position.column;
	});
}
