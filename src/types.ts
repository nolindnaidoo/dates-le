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

export interface DatesLeError {
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

export interface ParseError extends DatesLeError {
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
	| 'csv'
	| 'xml'
	| 'log'
	| 'javascript'
	| 'html'
	| 'unknown';

export interface Configuration {
	readonly copyToClipboardEnabled: boolean;
	readonly notificationsLevel: 'all' | 'important' | 'silent';
	readonly openResultsSideBySide: boolean;
	readonly safetyEnabled: boolean;
	readonly safetyFileSizeWarnBytes: number;
	readonly statusBarEnabled: boolean;
	readonly telemetryEnabled: boolean;
}
