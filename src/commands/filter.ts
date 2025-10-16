import * as vscode from 'vscode';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { DateValue } from '../types';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Localizer } from '../utils/localization';
import type { PerformanceMonitor } from '../utils/performance';

export interface DateFilterOptions {
	readonly dateRange?: {
		readonly start: Date;
		readonly end: Date;
	};
	readonly formats?: string[];
	readonly excludeFormats?: string[];
	readonly excludeDuplicates?: boolean;
	readonly excludeInvalid?: boolean;
	readonly excludeFuture?: boolean;
	readonly excludePast?: boolean;
	readonly customFilter?: (date: DateValue) => boolean;
}

export function registerFilterCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
		localizer: Localizer;
		performanceMonitor: PerformanceMonitor;
		errorHandler: ErrorHandler;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.filter',
		async () => {
			deps.telemetry.event('command-filter');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning('No active editor found');
				return;
			}

			const document = editor.document;
			const content = document.getText();
			const languageId = document.languageId;

			try {
				// Show progress
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Filtering dates...',
						cancellable: true,
					},
					async (progress, token) => {
						progress.report({ increment: 0, message: 'Extracting dates...' });

						// Extract dates first
						const extractionResult = await extractDates(content, languageId);

						if (token.isCancellationRequested) return;

						if (
							!extractionResult.success ||
							extractionResult.dates.length === 0
						) {
							deps.notifier.showInfo('No dates found to filter');
							return;
						}

						progress.report({
							increment: 30,
							message: 'Configuring filters...',
						});

						// Let user configure filters
						const filterOptions = await configureFilters(
							extractionResult.dates,
						);

						if (token.isCancellationRequested || !filterOptions) return;

						progress.report({ increment: 50, message: 'Applying filters...' });

						// Apply filters
						const filteredDates = applyFilters(
							extractionResult.dates,
							filterOptions,
						);

						if (token.isCancellationRequested) return;

						progress.report({
							increment: 80,
							message: 'Generating results...',
						});

						// Generate filter report
						const report = generateFilterReport(
							extractionResult.dates,
							filteredDates,
							filterOptions,
						);

						progress.report({ increment: 100, message: 'Opening results...' });

						// Open results
						await openFilterResults(report, deps.notifier);

						deps.telemetry.event('command-filter-success', {
							originalCount: extractionResult.dates.length,
							filteredCount: filteredDates.length,
							filtersApplied: Object.keys(filterOptions).length,
						});
					},
				);
			} catch (error) {
				deps.errorHandler.handle({
					category: 'operational',
					originalError:
						error instanceof Error ? error : new Error(String(error)),
					message: 'Failed to filter dates',
					userFriendlyMessage:
						'Date filtering failed. Please check the file format and try again.',
					suggestion: 'Ensure the file contains valid date formats',
					recoverable: true,
					timestamp: new Date(),
				});
			}
		},
	);

	context.subscriptions.push(command);
}

async function configureFilters(
	dates: readonly DateValue[],
): Promise<DateFilterOptions | null> {
	const options: {
		dateRange?: { start: Date; end: Date };
		formats?: string[];
		excludeFormats?: string[];
		excludeDuplicates?: boolean;
		excludeInvalid?: boolean;
		excludeFuture?: boolean;
		excludePast?: boolean;
		customFilter?: (date: DateValue) => boolean;
	} = {};

	// Get unique formats for filtering
	const uniqueFormats = Array.from(new Set(dates.map((d) => d.format)));

	// Ask user what filters to apply
	const filterChoices = await vscode.window.showQuickPick(
		[
			{
				label: 'Date Range',
				description: 'Filter by date range (from/to)',
				id: 'dateRange',
			},
			{
				label: 'Include Formats',
				description: 'Only include specific date formats',
				id: 'includeFormats',
			},
			{
				label: 'Exclude Formats',
				description: 'Exclude specific date formats',
				id: 'excludeFormats',
			},
			{
				label: 'Remove Duplicates',
				description: 'Remove duplicate dates',
				id: 'excludeDuplicates',
			},
			{
				label: 'Remove Invalid',
				description: 'Remove invalid dates',
				id: 'excludeInvalid',
			},
			{
				label: 'Remove Future Dates',
				description: 'Remove future dates',
				id: 'excludeFuture',
			},
			{
				label: 'Remove Past Dates',
				description: 'Remove past dates',
				id: 'excludePast',
			},
		],
		{
			placeHolder: 'Select filters to apply (multiple selection)',
			title: 'Filter Dates - Select Filters',
			canPickMany: true,
		},
	);

	if (!filterChoices) return null;

	// Configure selected filters
	for (const choice of filterChoices) {
		switch (choice.id) {
			case 'dateRange': {
				const dateRange = await configureDateRange();
				if (dateRange) {
					options.dateRange = dateRange;
				}
				break;
			}
			case 'includeFormats': {
				const includeFormats = await vscode.window.showQuickPick(
					uniqueFormats.map((format) => ({
						label: format.toUpperCase(),
						description: `${dates.filter((d) => d.format === format).length} dates`,
						format,
					})),
					{
						placeHolder: 'Select formats to include',
						title: 'Include Date Formats',
						canPickMany: true,
					},
				);
				if (includeFormats) {
					options.formats = includeFormats.map((f) => f.format);
				}
				break;
			}
			case 'excludeFormats': {
				const excludeFormats = await vscode.window.showQuickPick(
					uniqueFormats.map((format) => ({
						label: format.toUpperCase(),
						description: `${dates.filter((d) => d.format === format).length} dates`,
						format,
					})),
					{
						placeHolder: 'Select formats to exclude',
						title: 'Exclude Date Formats',
						canPickMany: true,
					},
				);
				if (excludeFormats) {
					options.excludeFormats = excludeFormats.map((f) => f.format);
				}
				break;
			}
			case 'excludeDuplicates':
				options.excludeDuplicates = true;
				break;
			case 'excludeInvalid':
				options.excludeInvalid = true;
				break;
			case 'excludeFuture':
				options.excludeFuture = true;
				break;
			case 'excludePast':
				options.excludePast = true;
				break;
		}
	}

	return options as DateFilterOptions;
}

async function configureDateRange(): Promise<{
	start: Date;
	end: Date;
} | null> {
	// For now, we'll use a simple input box
	// In a real implementation, you might want to use a date picker
	const startDateStr = await vscode.window.showInputBox({
		placeHolder: 'YYYY-MM-DD',
		prompt: 'Enter start date (YYYY-MM-DD)',
		title: 'Date Range Filter - Start Date',
	});

	if (!startDateStr) return null;

	const endDateStr = await vscode.window.showInputBox({
		placeHolder: 'YYYY-MM-DD',
		prompt: 'Enter end date (YYYY-MM-DD)',
		title: 'Date Range Filter - End Date',
	});

	if (!endDateStr) return null;

	const start = new Date(startDateStr);
	const end = new Date(endDateStr);

	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		vscode.window.showErrorMessage(
			'Invalid date format. Please use YYYY-MM-DD',
		);
		return null;
	}

	return { start, end };
}

function applyFilters(
	dates: readonly DateValue[],
	options: DateFilterOptions,
): DateValue[] {
	let filtered = [...dates];

	// Apply date range filter
	if (options.dateRange) {
		filtered = filtered.filter((date) => {
			if (!date.timestamp) return false;
			const dateObj = new Date(date.timestamp);
			return (
				dateObj >= options.dateRange!.start && dateObj <= options.dateRange!.end
			);
		});
	}

	// Apply format include filter
	if (options.formats && options.formats.length > 0) {
		filtered = filtered.filter((date) =>
			options.formats!.includes(date.format),
		);
	}

	// Apply format exclude filter
	if (options.excludeFormats && options.excludeFormats.length > 0) {
		filtered = filtered.filter(
			(date) => !options.excludeFormats!.includes(date.format),
		);
	}

	// Remove duplicates
	if (options.excludeDuplicates) {
		const seen = new Set<string>();
		filtered = filtered.filter((date) => {
			if (seen.has(date.value)) return false;
			seen.add(date.value);
			return true;
		});
	}

	// Remove invalid dates
	if (options.excludeInvalid) {
		filtered = filtered.filter((date) => {
			if (!date.timestamp) return false;
			return !Number.isNaN(new Date(date.timestamp).getTime());
		});
	}

	// Remove future dates
	if (options.excludeFuture) {
		const now = new Date();
		filtered = filtered.filter((date) => {
			if (!date.timestamp) return false;
			return new Date(date.timestamp) <= now;
		});
	}

	// Remove past dates
	if (options.excludePast) {
		const now = new Date();
		filtered = filtered.filter((date) => {
			if (!date.timestamp) return false;
			return new Date(date.timestamp) >= now;
		});
	}

	// Apply custom filter
	if (options.customFilter) {
		filtered = filtered.filter(options.customFilter);
	}

	return filtered;
}

function generateFilterReport(
	originalDates: readonly DateValue[],
	filteredDates: DateValue[],
	options: DateFilterOptions,
): string {
	const report = [
		'# Date Filter Report',
		'',
		`**Original Dates**: ${originalDates.length}`,
		`**Filtered Dates**: ${filteredDates.length}`,
		`**Removed**: ${originalDates.length - filteredDates.length}`,
		'',
	];

	// Show applied filters
	report.push('## Applied Filters');
	report.push('');

	if (options.dateRange) {
		report.push(
			`- **Date Range**: ${options.dateRange.start.toISOString()} to ${options.dateRange.end.toISOString()}`,
		);
	}
	if (options.formats) {
		report.push(`- **Include Formats**: ${options.formats.join(', ')}`);
	}
	if (options.excludeFormats) {
		report.push(`- **Exclude Formats**: ${options.excludeFormats.join(', ')}`);
	}
	if (options.excludeDuplicates) {
		report.push('- **Remove Duplicates**: Yes');
	}
	if (options.excludeInvalid) {
		report.push('- **Remove Invalid Dates**: Yes');
	}
	if (options.excludeFuture) {
		report.push('- **Remove Future Dates**: Yes');
	}
	if (options.excludePast) {
		report.push('- **Remove Past Dates**: Yes');
	}

	report.push('');

	// Show filtered results
	report.push('## Filtered Dates');
	report.push('');

	if (filteredDates.length === 0) {
		report.push('No dates match the applied filters.');
	} else {
		filteredDates.forEach((date, index) => {
			report.push(`${index + 1}. ${date.value} (${date.format.toUpperCase()})`);
		});
	}

	return report.join('\n');
}

async function openFilterResults(
	report: string,
	notifier: Notifier,
): Promise<void> {
	const doc = await vscode.workspace.openTextDocument({
		content: report,
		language: 'markdown',
	});

	await vscode.window.showTextDocument(doc, {
		viewColumn: vscode.ViewColumn.Beside,
		preserveFocus: true,
	});

	notifier.showInfo('Date filtering complete. Results opened in new editor.');
}
