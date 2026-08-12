export interface ExtractionResult {
	readonly success: boolean;
	readonly dates: readonly DateValue[];
	readonly errors: readonly ParseError[];
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
	| 'week'
	| 'ordinal'
	| 'basic'
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

/**
 * A mutable working copy of a readonly options interface.
 *
 * Prompt functions build their result field by field, which a `readonly`
 * interface forbids. Declaring a hand-written mutable mirror and casting back
 * with `as` on return means two copies of every option shape, free to drift,
 * and a cast sitting exactly where user input becomes configuration.
 * TypeScript assigns `Draft<T>` back to `T` without a cast because
 * assignability ignores `readonly` property modifiers.
 */
export type Draft<T> = { -readonly [K in keyof T]: T[K] };
