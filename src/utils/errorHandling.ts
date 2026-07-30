export type ErrorCategory =
	| 'parse'
	| 'validation'
	| 'safety'
	| 'operational'
	| 'file-system'
	| 'configuration';

export interface EnhancedError {
	readonly category: ErrorCategory;
	readonly originalError: Error;
	readonly message: string;
	readonly userFriendlyMessage: string;
	readonly suggestion: string;
	readonly recoverable: boolean;
	readonly timestamp: Date;
}

export interface ErrorHandler {
	handle(error: EnhancedError): void;
	dispose(): void;
}

export interface ErrorLogger {
	log(error: EnhancedError): void;
	dispose(): void;
}

export interface ErrorNotifier {
	notify(error: EnhancedError): void;
	dispose(): void;
}

export function createEnhancedError(
	error: Error,
	category: ErrorCategory,
	context?: string,
): EnhancedError {
	return Object.freeze({
		category,
		originalError: error,
		message: error.message,
		userFriendlyMessage: buildUserFriendlyMessage(error, category, context),
		suggestion: buildSuggestion(category),
		recoverable: isRecoverable(error, category),
		timestamp: new Date(),
	});
}

export function createErrorHandler(_config: {
	showParseErrors: boolean;
	notificationsLevel: string;
}): ErrorHandler {
	return Object.freeze({
		handle(error: EnhancedError): void {
			console.error(`[Dates-LE] Error: ${error.message}`);
		},
		dispose(): void {
			// Cleanup if needed
		},
	});
}

export function createErrorLogger(outputChannel: {
	appendLine: (message: string) => void;
}): ErrorLogger {
	return Object.freeze({
		log(error: EnhancedError): void {
			const sanitizedMessage = sanitizeMessage(error.message);
			outputChannel.appendLine(`[Dates-LE] ${sanitizedMessage}`);
		},
		dispose(): void {
			// Cleanup if needed
		},
	});
}

export function createErrorNotifier(): ErrorNotifier {
	return Object.freeze({
		notify(error: EnhancedError): void {
			const sanitizedMessage = sanitizeMessage(error.userFriendlyMessage);
			console.warn(`[Dates-LE] ${sanitizedMessage}`);
		},
		dispose(): void {
			// Cleanup if needed
		},
	});
}

export function sanitizeMessage(message: string): string {
	return message
		.replace(/\/Users\/[^/]+\//g, '/Users/***/')
		.replace(/\/home\/[^/]+\//g, '/home/***/')
		.replace(/C:\\Users\\[^\\]+\\/g, 'C:\\Users\\***\\')
		.replace(/password[=:]\s*[^\s]+/gi, 'password=***')
		.replace(/token[=:]\s*[^\s]+/gi, 'token=***')
		.replace(/key[=:]\s*[^\s]+/gi, 'key=***');
}

function isRecoverable(error: Error, category: ErrorCategory): boolean {
	switch (category) {
		case 'safety':
			return false;
		case 'operational':
			return !error.message.includes('fatal');
		case 'file-system':
			return (
				error.message.includes('permission') ||
				error.message.includes('network')
			);
		default:
			return true;
	}
}

function buildUserFriendlyMessage(
	error: Error,
	category: ErrorCategory,
	context?: string,
): string {
	switch (category) {
		case 'parse':
			return `Failed to parse date values: ${context || 'unknown file'}`;
		case 'file-system':
			return `File system error: ${error.message}`;
		case 'configuration':
			return `Configuration error: ${error.message}`;
		case 'validation':
			return `Date validation failed: ${error.message}`;
		case 'safety':
			return `Safety threshold exceeded: ${error.message}`;
		case 'operational':
			return `Date extraction failed: ${error.message}`;
		default:
			return `Unknown error: ${error.message}`;
	}
}

function buildSuggestion(category: ErrorCategory): string {
	switch (category) {
		case 'parse':
			return 'Check the date format and ensure values are valid';
		case 'file-system':
			return 'Check file permissions and ensure the file exists';
		case 'configuration':
			return 'Reset to default settings or check configuration syntax';
		case 'validation':
			return 'Review date values and ensure they meet validation criteria';
		case 'safety':
			return 'Reduce file size or adjust safety thresholds';
		case 'operational':
			return 'Try again or check system resources';
		default:
			return 'Check the logs for more details and consider reporting this issue';
	}
}
