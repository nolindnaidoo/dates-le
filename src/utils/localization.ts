import * as nls from 'vscode-nls';

export interface Localizer {
	readonly localize: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeError: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeWarning: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeInfo: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeProgress: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeStatus: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeRecovery: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizePerformance: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeSafety: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeConfirmation: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
}

export function createLocalizer(): Localizer {
	const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

	return Object.freeze({
		localize(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeError(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeWarning(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeInfo(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeProgress(
			key: string,
			...args: (string | number | boolean | null | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeStatus(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeRecovery(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizePerformance(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeSafety(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeConfirmation(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},
	});
}

export const messages = Object.freeze({
	// Error messages
	errorParsing: 'runtime.error.parsing',
	errorValidation: 'runtime.error.validation',
	errorFileSystem: 'runtime.error.file-system',
	errorConfiguration: 'runtime.error.configuration',
	errorPerformance: 'runtime.error.performance',
	errorUnknown: 'runtime.error.unknown',

	// Warning messages
	warningLargeFile: 'runtime.warning.large-file',
	warningMemoryUsage: 'runtime.warning.memory-usage',
	warningPerformance: 'runtime.warning.performance',

	// Info messages
	infoExtractionComplete: 'runtime.info.extraction-complete',
	infoAnalysisComplete: 'runtime.info.analysis-complete',
	infoConversionComplete: 'runtime.info.conversion-complete',

	// Progress messages
	progressExtracting: 'runtime.progress.extracting',
	progressAnalyzing: 'runtime.progress.analyzing',
	progressConverting: 'runtime.progress.converting',
	progressValidating: 'runtime.progress.validating',

	// Status messages
	statusExtracting: 'runtime.status.extracting',
	statusAnalyzing: 'runtime.status.analyzing',
	statusConverting: 'runtime.status.converting',
	statusValidating: 'runtime.status.validating',

	// Recovery messages
	recoveryRetry: 'runtime.recovery.retry',
	recoveryFallback: 'runtime.recovery.fallback',
	recoverySkip: 'runtime.recovery.skip',
	recoveryAbort: 'runtime.recovery.abort',

	// Performance messages
	performanceDuration: 'runtime.performance.duration',
	performanceMemory: 'runtime.performance.memory',
	performanceThroughput: 'runtime.performance.throughput',
	performanceCpu: 'runtime.performance.cpu',

	// Safety messages
	safetyFileSizeWarning: 'runtime.safety.file-size-warning',
	safetyOutputSizeWarning: 'runtime.safety.output-size-warning',
	safetyManyDocumentsWarning: 'runtime.safety.many-documents-warning',

	// Confirmation messages
	confirmationContinue: 'runtime.confirmation.continue',
	confirmationCancel: 'runtime.confirmation.cancel',
	confirmationYes: 'runtime.confirmation.yes',
	confirmationNo: 'runtime.confirmation.no',
});

export function formatMessage(template: string, ...args: unknown[]): string {
	if (args.length === 0) {
		return template;
	}

	return template.replace(/\{(\d+)\}/g, (match, index) => {
		const argIndex = parseInt(index, 10);
		const arg = args[argIndex];
		return arg !== undefined ? String(arg) : match;
	});
}

export function formatList(
	items: string[],
	conjunction: string = 'and',
): string {
	if (items.length === 0) return '';
	if (items.length === 1) return items[0] || '';
	if (items.length === 2)
		return `${items[0] || ''} ${conjunction} ${items[1] || ''}`;

	const lastItem = items[items.length - 1] || '';
	const otherItems = items.slice(0, -1);
	return `${otherItems.join(', ')}, ${conjunction} ${lastItem}`;
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(milliseconds: number): string {
	if (milliseconds < 1000) {
		return `${milliseconds}ms`;
	}

	const seconds = milliseconds / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(2)}s`;
	}

	const minutes = seconds / 60;
	if (minutes < 60) {
		return `${minutes.toFixed(2)}m`;
	}

	const hours = minutes / 60;
	return `${hours.toFixed(2)}h`;
}

export function formatThroughput(throughput: number): string {
	if (throughput < 1000) {
		return `${throughput.toFixed(0)} items/s`;
	}

	const k = throughput / 1000;
	if (k < 1000) {
		return `${k.toFixed(1)}K items/s`;
	}

	const m = k / 1000;
	return `${m.toFixed(1)}M items/s`;
}

export function formatCount(
	count: number,
	singular: string,
	plural: string,
): string {
	return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

export function formatPercentage(value: number, total: number): string {
	if (total === 0) return '0%';
	return `${((value / total) * 100).toFixed(1)}%`;
}

export function formatDate(
	date: Date,
	format: 'iso' | 'rfc2822' | 'unix' | 'utc' | 'local' = 'iso',
): string {
	switch (format) {
		case 'iso':
			return date.toISOString();
		case 'rfc2822':
			return date.toUTCString();
		case 'unix':
			return Math.floor(date.getTime() / 1000).toString();
		case 'utc':
			return date.toUTCString();
		case 'local':
			return date.toString();
		default:
			return date.toISOString();
	}
}

export function formatDateRange(start: Date, end: Date): string {
	const startStr = start.toISOString();
	const endStr = end.toISOString();

	if (startStr === endStr) {
		return startStr;
	}

	return `${startStr} - ${endStr}`;
}

export function formatTimezone(date: Date): string {
	const offset = date.getTimezoneOffset();
	const hours = Math.floor(Math.abs(offset) / 60);
	const minutes = Math.abs(offset) % 60;
	const sign = offset <= 0 ? '+' : '-';

	return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
	const diff = now.getTime() - date.getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return `${days} day${days === 1 ? '' : 's'} ago`;
	}

	if (hours > 0) {
		return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	}

	if (minutes > 0) {
		return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	}

	if (seconds > 0) {
		return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
	}

	return 'just now';
}

export function formatFileSize(bytes: number): string {
	return formatBytes(bytes);
}

export function formatNumber(value: number, decimals: number = 2): string {
	return value.toFixed(decimals);
}

export function formatInteger(value: number): string {
	return Math.floor(value).toString();
}

export function formatBoolean(value: boolean): string {
	return value ? 'Yes' : 'No';
}

export function formatArray<T>(
	items: T[],
	formatter: (item: T) => string = String,
): string {
	if (items.length === 0) return 'None';
	if (items.length === 1) return formatter(items[0]!);
	if (items.length <= 3) return items.map(formatter).join(', ');

	return `${formatter(items[0]!)}, ${formatter(items[1]!)}, ... and ${items.length - 2} more`;
}

export function formatObject(
	obj: Record<string, unknown>,
	maxDepth: number = 2,
): string {
	if (maxDepth <= 0) return '[Object]';

	const entries = Object.entries(obj);
	if (entries.length === 0) return '{}';

	const formatted = entries
		.slice(0, 5) // Limit to first 5 entries
		.map(([key, value]) => {
			if (typeof value === 'object' && value !== null) {
				return `${key}: ${formatObject(value as Record<string, unknown>, maxDepth - 1)}`;
			}
			return `${key}: ${String(value)}`;
		})
		.join(', ');

	if (entries.length > 5) {
		return `{${formatted}, ... and ${entries.length - 5} more}`;
	}

	return `{${formatted}}`;
}

export function formatDateCount(count: number): string {
	return formatCount(count, 'date', 'dates');
}

export function formatDateAnalysis(analysis: {
	totalDates: number;
	uniqueDates: number;
	formats: Record<string, number>;
	timezones: number;
}): string {
	const lines = [
		`Total Dates: ${analysis.totalDates}`,
		`Unique Dates: ${analysis.uniqueDates}`,
		`Formats: ${formatDateFormatDistribution(analysis.formats)}`,
	];

	if (analysis.timezones > 0) {
		lines.push(`Timezones: ${analysis.timezones}`);
	}

	return lines.join('\n');
}

export function formatDateStatistics(stats: {
	total: number;
	unique: number;
	duplicates: number;
	formats: Record<string, number>;
}): string {
	return [
		`Total: ${stats.total}`,
		`Unique: ${stats.unique}`,
		`Duplicates: ${stats.duplicates}`,
		`Formats: ${formatDateFormatDistribution(stats.formats)}`,
	].join(' | ');
}

export function formatDateFormatDistribution(
	formats: Record<string, number>,
): string {
	const localizer = createLocalizer();
	const entries = Object.entries(formats).filter(([, count]) => count > 0);
	if (entries.length === 0)
		return localizer.localize('runtime.formats.none', 'No date formats');

	const total = entries.reduce((sum, [, count]) => sum + count, 0);
	const formatted = entries.map(
		([format, count]) =>
			`${format.toUpperCase()} (${formatPercentage(count, total)})`,
	);

	return formatList(formatted);
}
