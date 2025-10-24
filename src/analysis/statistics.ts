import type { DateValue } from '../types';

export interface DateStatistics {
	readonly total: number;
	readonly unique: number;
	readonly duplicates: number;
	readonly earliest: Date | null;
	readonly latest: Date | null;
	readonly range: number | null; // in milliseconds
	readonly average: Date | null;
	readonly median: Date | null;
	readonly formats: Record<string, number>;
	readonly timezones: Record<string, number>;
	readonly years: Record<number, number>;
	readonly months: Record<number, number>;
	readonly daysOfWeek: Record<number, number>;
	readonly hours: Record<number, number>;
}

export interface DateAnalysis {
	readonly statistics: DateStatistics;
	readonly anomalies: DateAnomaly[];
	readonly patterns: DatePattern[];
	readonly clusters: DateCluster[];
	readonly gaps: DateGap[];
}

export interface DateAnomaly {
	readonly type:
		| 'future'
		| 'invalid'
		| 'outlier'
		| 'duplicate'
		| 'format-inconsistent';
	readonly date: DateValue;
	readonly severity: 'low' | 'medium' | 'high';
	readonly description: string;
	readonly suggestion?: string;
}

export interface DatePattern {
	readonly type: 'frequency' | 'interval' | 'seasonal' | 'trend';
	readonly description: string;
	readonly confidence: number; // 0-1
	readonly examples: string[];
}

export interface DateCluster {
	readonly center: Date;
	readonly dates: DateValue[];
	readonly density: number;
	readonly description: string;
}

export interface DateGap {
	readonly start: Date;
	readonly end: Date;
	readonly duration: number; // in milliseconds
	readonly description: string;
}

/**
 * Calculate comprehensive statistics for a collection of dates
 */
export function calculateDateStatistics(
	dates: readonly DateValue[],
): DateStatistics {
	if (dates.length === 0) {
		return {
			total: 0,
			unique: 0,
			duplicates: 0,
			earliest: null,
			latest: null,
			range: null,
			average: null,
			median: null,
			formats: {},
			timezones: {},
			years: {},
			months: {},
			daysOfWeek: {},
			hours: {},
		};
	}

	// Convert to Date objects and filter valid dates
	const validDates = dates
		.map((d) => (d.timestamp ? new Date(d.timestamp) : null))
		.filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));

	if (validDates.length === 0) {
		return {
			total: dates.length,
			unique: 0,
			duplicates: dates.length,
			earliest: null,
			latest: null,
			range: null,
			average: null,
			median: null,
			formats: {},
			timezones: {},
			years: {},
			months: {},
			daysOfWeek: {},
			hours: {},
		};
	}

	// Sort dates for calculations
	const sortedDates = [...validDates].sort((a, b) => a.getTime() - b.getTime());

	// Calculate basic statistics
	const total = dates.length;
	const unique = new Set(validDates.map((d) => d.getTime())).size;
	const duplicates = total - unique;

	const earliest = sortedDates[0]!;
	const latest = sortedDates[sortedDates.length - 1]!;
	const range = latest.getTime() - earliest.getTime();

	// Calculate average (mean)
	const averageTimestamp =
		validDates.reduce((sum, d) => sum + d.getTime(), 0) / validDates.length;
	const average = new Date(averageTimestamp);

	// Calculate median
	const medianIndex = Math.floor(sortedDates.length / 2);
	const median =
		sortedDates.length % 2 === 0
			? new Date(
					(sortedDates[medianIndex - 1]!.getTime() +
						sortedDates[medianIndex]!.getTime()) /
						2,
				)
			: sortedDates[medianIndex]!;

	// Analyze formats
	const formats: Record<string, number> = {};
	dates.forEach((d) => {
		formats[d.format] = (formats[d.format] || 0) + 1;
	});

	// Analyze timezones
	const timezones: Record<string, number> = {};
	validDates.forEach((d) => {
		const tz = d.getTimezoneOffset();
		timezones[tz.toString()] = (timezones[tz.toString()] || 0) + 1;
	});

	// Analyze temporal patterns
	const years: Record<number, number> = {};
	const months: Record<number, number> = {};
	const daysOfWeek: Record<number, number> = {};
	const hours: Record<number, number> = {};

	validDates.forEach((d) => {
		years[d.getFullYear()] = (years[d.getFullYear()] || 0) + 1;
		months[d.getMonth()] = (months[d.getMonth()] || 0) + 1;
		daysOfWeek[d.getDay()] = (daysOfWeek[d.getDay()] || 0) + 1;
		hours[d.getHours()] = (hours[d.getHours()] || 0) + 1;
	});

	return Object.freeze({
		total,
		unique,
		duplicates,
		earliest,
		latest,
		range,
		average,
		median,
		formats,
		timezones,
		years,
		months,
		daysOfWeek,
		hours,
	});
}

/**
 * Detect anomalies in date data
 */
export function detectDateAnomalies(
	dates: readonly DateValue[],
): DateAnomaly[] {
	const anomalies: DateAnomaly[] = [];
	const now = new Date();
	const validDates = dates.filter(
		(d) => d.timestamp && !Number.isNaN(new Date(d.timestamp).getTime()),
	);

	// Detect future dates
	dates.forEach((date) => {
		if (date.timestamp) {
			const dateObj = new Date(date.timestamp);
			if (dateObj > now) {
				anomalies.push({
					type: 'future',
					date,
					severity: 'medium',
					description: `Future date detected: ${date.value}`,
					suggestion: 'Verify if this is expected or a data entry error',
				});
			}
		}
	});

	// Detect invalid dates
	dates.forEach((date) => {
		if (date.timestamp && Number.isNaN(new Date(date.timestamp).getTime())) {
			anomalies.push({
				type: 'invalid',
				date,
				severity: 'high',
				description: `Invalid date format: ${date.value}`,
				suggestion: 'Check date format and ensure it matches expected pattern',
			});
		}
	});

	// Detect outliers using IQR method
	if (validDates.length > 4) {
		const timestamps = validDates
			.map((d) => d.timestamp!)
			.sort((a, b) => a - b);
		const q1Index = Math.floor(timestamps.length * 0.25);
		const q3Index = Math.floor(timestamps.length * 0.75);
		const q1 = timestamps[q1Index]!;
		const q3 = timestamps[q3Index]!;
		const iqr = q3 - q1;
		const lowerBound = q1 - 1.5 * iqr;
		const upperBound = q3 + 1.5 * iqr;

		validDates.forEach((date) => {
			if (date.timestamp! < lowerBound || date.timestamp! > upperBound) {
				anomalies.push({
					type: 'outlier',
					date,
					severity: 'low',
					description: `Date outlier detected: ${date.value}`,
					suggestion:
						'Review if this date is expected or represents an anomaly',
				});
			}
		});
	}

	// Detect format inconsistencies
	const formatGroups = new Map<string, DateValue[]>();
	dates.forEach((date) => {
		const group = formatGroups.get(date.format) || [];
		group.push(date);
		formatGroups.set(date.format, group);
	});

	if (formatGroups.size > 1) {
		const dominantFormat = Array.from(formatGroups.entries()).sort(
			([, a], [, b]) => b.length - a.length,
		)[0]![0];

		dates.forEach((date) => {
			if (date.format !== dominantFormat) {
				anomalies.push({
					type: 'format-inconsistent',
					date,
					severity: 'low',
					description: `Inconsistent date format: ${date.value} (${date.format})`,
					suggestion: `Consider standardizing to ${dominantFormat} format`,
				});
			}
		});
	}

	return anomalies;
}

/**
 * Detect patterns in date data
 */
export function detectDatePatterns(dates: readonly DateValue[]): DatePattern[] {
	const patterns: DatePattern[] = [];
	const validDates = dates
		.filter(
			(d) => d.timestamp && !Number.isNaN(new Date(d.timestamp).getTime()),
		)
		.map((d) => ({ ...d, date: new Date(d.timestamp!) }));

	if (validDates.length < 3) return patterns;

	// Detect frequency patterns
	const intervals = calculateIntervals(validDates);
	if (intervals.length > 0) {
		const mostCommonInterval = findMostCommonInterval(intervals);
		if (mostCommonInterval) {
			patterns.push({
				type: 'frequency',
				description: `Regular interval pattern: ${formatInterval(mostCommonInterval)}`,
				confidence: calculateConfidence(intervals, mostCommonInterval),
				examples: validDates.slice(0, 3).map((d) => d.value),
			});
		}
	}

	// Detect seasonal patterns
	const seasonalPattern = detectSeasonalPattern(validDates);
	if (seasonalPattern) {
		patterns.push(seasonalPattern);
	}

	// Detect trend patterns
	const trendPattern = detectTrendPattern(validDates);
	if (trendPattern) {
		patterns.push(trendPattern);
	}

	return patterns;
}

/**
 * Cluster dates by temporal proximity
 */
export function clusterDates(dates: readonly DateValue[]): DateCluster[] {
	const validDates = dates
		.filter(
			(d) => d.timestamp && !Number.isNaN(new Date(d.timestamp).getTime()),
		)
		.map((d) => ({ ...d, date: new Date(d.timestamp!) }));

	if (validDates.length === 0) return [];

	// Simple clustering based on temporal proximity
	const clusters: DateCluster[] = [];
	const processed = new Set<number>();
	const clusterThreshold = 24 * 60 * 60 * 1000; // 24 hours

	validDates.forEach((date, index) => {
		if (processed.has(index)) return;

		const clusterDates = [date];
		const clusterTimestamps = [date.date.getTime()];
		processed.add(index);

		// Find nearby dates
		validDates.forEach((otherDate, otherIndex) => {
			if (processed.has(otherIndex)) return;

			const timeDiff = Math.abs(date.date.getTime() - otherDate.date.getTime());
			if (timeDiff <= clusterThreshold) {
				clusterDates.push(otherDate);
				clusterTimestamps.push(otherDate.date.getTime());
				processed.add(otherIndex);
			}
		});

		// Calculate cluster center
		const centerTimestamp =
			clusterTimestamps.reduce((sum, ts) => sum + ts, 0) /
			clusterTimestamps.length;
		const center = new Date(centerTimestamp);

		// Calculate density
		const density = clusterDates.length / (clusterThreshold / (60 * 60 * 1000)); // dates per hour

		clusters.push({
			center,
			dates: clusterDates,
			density,
			description: `${clusterDates.length} dates clustered around ${center.toISOString()}`,
		});
	});

	return clusters;
}

/**
 * Detect gaps in date sequences
 */
export function detectDateGaps(dates: readonly DateValue[]): DateGap[] {
	const validDates = dates
		.filter(
			(d) => d.timestamp && !Number.isNaN(new Date(d.timestamp).getTime()),
		)
		.map((d) => new Date(d.timestamp!))
		.sort((a, b) => a.getTime() - b.getTime());

	if (validDates.length < 2) return [];

	const gaps: DateGap[] = [];
	const gapThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

	for (let i = 1; i < validDates.length; i++) {
		const prev = validDates[i - 1]!;
		const curr = validDates[i]!;
		const duration = curr.getTime() - prev.getTime();

		if (duration > gapThreshold) {
			gaps.push({
				start: prev,
				end: curr,
				duration,
				description: `Gap of ${formatDuration(
					duration,
				)} between ${prev.toISOString()} and ${curr.toISOString()}`,
			});
		}
	}

	return gaps;
}

/**
 * Perform comprehensive date analysis
 */
export function analyzeDates(dates: readonly DateValue[]): DateAnalysis {
	const statistics = calculateDateStatistics(dates);
	const anomalies = detectDateAnomalies(dates);
	const patterns = detectDatePatterns(dates);
	const clusters = clusterDates(dates);
	const gaps = detectDateGaps(dates);

	return Object.freeze({
		statistics,
		anomalies,
		patterns,
		clusters,
		gaps,
	});
}

// Helper functions

function calculateIntervals(dates: Array<{ date: Date }>): number[] {
	const intervals: number[] = [];
	for (let i = 1; i < dates.length; i++) {
		intervals.push(dates[i]!.date.getTime() - dates[i - 1]!.date.getTime());
	}
	return intervals;
}

function findMostCommonInterval(intervals: number[]): number | null {
	const tolerance = 0.1; // 10% tolerance
	const groups = new Map<number, number[]>();

	intervals.forEach((interval) => {
		let found = false;
		for (const [key] of groups) {
			if (Math.abs(interval - key) / key <= tolerance) {
				groups.get(key)!.push(interval);
				found = true;
				break;
			}
		}
		if (!found) {
			groups.set(interval, [interval]);
		}
	});

	let maxCount = 0;
	let mostCommon: number | null = null;

	for (const [interval, group] of groups) {
		if (group.length > maxCount) {
			maxCount = group.length;
			mostCommon = interval;
		}
	}

	return mostCommon;
}

function calculateConfidence(
	intervals: number[],
	targetInterval: number,
): number {
	const tolerance = 0.1;
	const matches = intervals.filter(
		(interval) =>
			Math.abs(interval - targetInterval) / targetInterval <= tolerance,
	);
	return matches.length / intervals.length;
}

function formatInterval(interval: number): string {
	const days = Math.floor(interval / (24 * 60 * 60 * 1000));
	const hours = Math.floor(
		(interval % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
	);
	const minutes = Math.floor((interval % (60 * 60 * 1000)) / (60 * 1000));

	if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
	if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
	return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

function detectSeasonalPattern(
	dates: Array<{ date: Date; value: string }>,
): DatePattern | null {
	// Simple seasonal detection based on months
	const monthCounts = new Array(12).fill(0);
	dates.forEach(({ date }) => {
		monthCounts[date.getMonth()]++;
	});

	const maxCount = Math.max(...monthCounts);
	const maxMonth = monthCounts.indexOf(maxCount);
	const totalDates = dates.length;

	if (maxCount / totalDates > 0.3) {
		// More than 30% in one month
		const monthNames = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December',
		];

		return {
			type: 'seasonal',
			description: `Seasonal pattern: ${((maxCount / totalDates) * 100).toFixed(1)}% of dates in ${
				monthNames[maxMonth]
			}`,
			confidence: maxCount / totalDates,
			examples: dates
				.filter(({ date }) => date.getMonth() === maxMonth)
				.slice(0, 3)
				.map((d) => d.value),
		};
	}

	return null;
}

function detectTrendPattern(
	dates: Array<{ date: Date; value: string }>,
): DatePattern | null {
	if (dates.length < 3) return null;

	// Simple trend detection using linear regression
	const timestamps = dates.map(({ date }, index) => ({
		x: index,
		y: date.getTime(),
	}));
	const n = timestamps.length;
	const sumX = timestamps.reduce((sum, p) => sum + p.x, 0);
	const sumY = timestamps.reduce((sum, p) => sum + p.y, 0);
	const sumXY = timestamps.reduce((sum, p) => sum + p.x * p.y, 0);
	const sumXX = timestamps.reduce((sum, p) => sum + p.x * p.x, 0);

	const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
	const confidence = Math.abs(slope) / (sumY / n); // Normalized slope

	if (confidence > 0.1) {
		// Significant trend
		const trend = slope > 0 ? 'increasing' : 'decreasing';
		return {
			type: 'trend',
			description: `${trend} trend detected in date sequence`,
			confidence: Math.min(confidence, 1),
			examples: dates.slice(0, 3).map((d) => d.value),
		};
	}

	return null;
}

function formatDuration(milliseconds: number): string {
	const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000));
	const hours = Math.floor(
		(milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
	);

	if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
	return `${hours} hour${hours > 1 ? 's' : ''}`;
}
