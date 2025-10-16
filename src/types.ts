export interface ExtractionResult {
	success: boolean;
	dates: readonly DateValue[];
	errors: readonly ParseError[];
}

export type ErrorCategory =
	| 'parsing'
	| 'validation'
	| 'file-system'
	| 'configuration'
	| 'url-validation'
	| 'analysis'
	| 'performance'
	| 'unknown';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type RecoveryAction =
	| 'retry'
	| 'fallback'
	| 'user-action'
	| 'skip'
	| 'abort';

export interface UrlsLeError {
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly message: string;
	readonly context?: string;
	readonly recoverable: boolean;
	readonly recoveryAction: RecoveryAction;
	readonly timestamp: number;
	readonly stack?: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ParseError extends UrlsLeError {
	readonly category: 'parsing';
	readonly filepath?: string;
	readonly position?: {
		readonly line: number;
		readonly column: number;
	};
}

export interface DateValue {
	readonly value: string;
	readonly format: DateFormat;
	readonly timestamp?: number;
	readonly timezone?: string;
	readonly position?: {
		readonly line: number;
		readonly column: number;
	};
	readonly context?: string;
}

export type DateFormat =
	| 'iso'
	| 'rfc2822'
	| 'unix'
	| 'utc'
	| 'local'
	| 'simple'
	| 'custom'
	| 'unknown';

export type FileType =
	| 'json'
	| 'yaml'
	| 'yml'
	| 'csv'
	| 'xml'
	| 'log'
	| 'javascript'
	| 'html'
	| 'unknown';

export interface Configuration {
	readonly copyToClipboardEnabled: boolean;
	readonly dedupeEnabled: boolean;
	readonly notificationsLevel: 'all' | 'important' | 'silent';
	readonly openResultsSideBySide: boolean;
	readonly safetyEnabled: boolean;
	readonly safetyFileSizeWarnBytes: number;
	readonly safetyLargeOutputLinesThreshold: number;
	readonly safetyManyDocumentsThreshold: number;
	readonly showParseErrors: boolean;
	readonly statusBarEnabled: boolean;
	readonly telemetryEnabled: boolean;
	readonly csvStreamingEnabled: boolean;
	readonly postProcessOpenInNewFile: boolean;
	readonly analysisEnabled: boolean;
	readonly analysisIncludeStats: boolean;
	readonly performanceEnabled: boolean;
	readonly performanceMaxDuration: number;
	readonly performanceMaxMemoryUsage: number;
	readonly performanceMaxCpuUsage: number;
	readonly performanceMinThroughput: number;
	readonly performanceMaxCacheSize: number;
	readonly keyboardShortcutsEnabled: boolean;
	readonly keyboardExtractShortcut: string;
	readonly keyboardDedupeShortcut: string;
	readonly keyboardSortShortcut: string;
	readonly presetsEnabled: boolean;
	readonly presetsDefaultPreset:
		| 'minimal'
		| 'balanced'
		| 'comprehensive'
		| 'performance'
		| 'dates';
}

// Re-export utility types for easier access
export type {
	ErrorHandler,
	ErrorLogger,
	ErrorNotifier,
} from './utils/errorHandling';
export type { Localizer } from './utils/localization';
export type {
	PerformanceMetrics,
	PerformanceMonitor,
	PerformanceThresholds,
} from './utils/performance';
