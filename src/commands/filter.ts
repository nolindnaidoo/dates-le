import * as vscode from 'vscode';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { DateValue, Draft } from '../types';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { sanitizeErrorMessage } from '../utils/errors';
import { generateFilterReport, openFilterResults } from './filterReport';

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
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.filter',
		async () => {
			deps.telemetry.event('command-filter');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning(vscode.l10n.t('No active editor found'));
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
						title: vscode.l10n.t('Filtering dates...'),
						cancellable: true,
					},
					async (progress, token) => {
						progress.report({
							increment: 0,
							message: vscode.l10n.t('Extracting dates...'),
						});

						// Extract dates first
						const extractionResult = await extractDates(content, languageId);

						if (token.isCancellationRequested) return;

						if (
							!extractionResult.success ||
							extractionResult.dates.length === 0
						) {
							deps.notifier.showInfo(vscode.l10n.t('No dates found to filter'));
							return;
						}

						progress.report({
							increment: 30,
							message: vscode.l10n.t('Configuring filters...'),
						});

						// Let user configure filters
						const filterOptions = await configureFilters(
							extractionResult.dates,
						);

						if (token.isCancellationRequested || !filterOptions) return;

						progress.report({
							increment: 50,
							message: vscode.l10n.t('Applying filters...'),
						});

						// Apply filters
						const filteredDates = applyFilters(
							extractionResult.dates,
							filterOptions,
						);

						if (token.isCancellationRequested) return;

						progress.report({
							increment: 80,
							message: vscode.l10n.t('Generating results...'),
						});

						// Generate filter report
						const report = generateFilterReport(
							extractionResult.dates,
							filteredDates,
							filterOptions,
						);

						progress.report({
							increment: 100,
							message: vscode.l10n.t('Opening results...'),
						});

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
				const message = error instanceof Error ? error.message : String(error);
				deps.notifier.showError(
					`Failed to filter dates: ${sanitizeErrorMessage(message)}`,
				);
			}
		},
	);

	context.subscriptions.push(command);
}

async function configureFilters(
	dates: readonly DateValue[],
): Promise<DateFilterOptions | null> {
	const options: Draft<DateFilterOptions> = {};

	// Get unique formats for filtering
	const uniqueFormats = Array.from(new Set(dates.map((d) => d.format)));

	// Ask user what filters to apply
	const filterChoices = await vscode.window.showQuickPick(
		[
			{
				label: vscode.l10n.t('Date Range'),
				description: vscode.l10n.t('Filter by date range (from/to)'),
				id: 'dateRange',
			},
			{
				label: vscode.l10n.t('Include Formats'),
				description: vscode.l10n.t('Only include specific date formats'),
				id: 'includeFormats',
			},
			{
				label: vscode.l10n.t('Exclude Formats'),
				description: vscode.l10n.t('Exclude specific date formats'),
				id: 'excludeFormats',
			},
			{
				label: vscode.l10n.t('Remove Duplicates'),
				description: vscode.l10n.t('Remove duplicate dates'),
				id: 'excludeDuplicates',
			},
			{
				label: vscode.l10n.t('Remove Invalid'),
				description: vscode.l10n.t('Remove invalid dates'),
				id: 'excludeInvalid',
			},
			{
				label: vscode.l10n.t('Remove Future Dates'),
				description: vscode.l10n.t('Remove future dates'),
				id: 'excludeFuture',
			},
			{
				label: vscode.l10n.t('Remove Past Dates'),
				description: vscode.l10n.t('Remove past dates'),
				id: 'excludePast',
			},
		],
		{
			placeHolder: vscode.l10n.t(
				'Select filters to apply (multiple selection)',
			),
			title: vscode.l10n.t('Filter Dates - Select Filters'),
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
						description: vscode.l10n.t(
							'{0} dates',
							dates.filter((d) => d.format === format).length,
						),
						format,
					})),
					{
						placeHolder: vscode.l10n.t('Select formats to include'),
						title: vscode.l10n.t('Include Date Formats'),
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
						description: vscode.l10n.t(
							'{0} dates',
							dates.filter((d) => d.format === format).length,
						),
						format,
					})),
					{
						placeHolder: vscode.l10n.t('Select formats to exclude'),
						title: vscode.l10n.t('Exclude Date Formats'),
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

	return options;
}

async function configureDateRange(): Promise<{
	start: Date;
	end: Date;
} | null> {
	// For now, we'll use a simple input box
	// In a real implementation, you might want to use a date picker
	const startDateStr = await vscode.window.showInputBox({
		placeHolder: vscode.l10n.t('YYYY-MM-DD'),
		prompt: vscode.l10n.t('Enter start date (YYYY-MM-DD)'),
		title: vscode.l10n.t('Date Range Filter - Start Date'),
	});

	if (!startDateStr) return null;

	const endDateStr = await vscode.window.showInputBox({
		placeHolder: vscode.l10n.t('YYYY-MM-DD'),
		prompt: vscode.l10n.t('Enter end date (YYYY-MM-DD)'),
		title: vscode.l10n.t('Date Range Filter - End Date'),
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
