import * as vscode from 'vscode';
import {
	convertDates,
	type DateConversionOptions,
	getAvailableFormats,
} from '../conversion/dateConverter';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Localizer } from '../utils/localization';
import type { PerformanceMonitor } from '../utils/performance';

export function registerConvertCommand(
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
		'dates-le.convert',
		async () => {
			deps.telemetry.event('command-convert');

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
						title: 'Converting dates...',
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
							deps.notifier.showInfo('No dates found to convert');
							return;
						}

						progress.report({
							increment: 30,
							message: 'Selecting target format...',
						});

						// Let user select target format
						const formatOptions = getAvailableFormats();
						const formatChoice = await vscode.window.showQuickPick(
							formatOptions.map((format) => ({
								label: format.name,
								description: format.description,
								detail: format.example,
								format: format.format,
							})),
							{
								placeHolder: 'Select target date format',
								title: 'Convert Dates - Select Format',
							},
						);

						if (token.isCancellationRequested || !formatChoice) return;

						progress.report({ increment: 50, message: 'Converting dates...' });

						// Convert dates
						const conversionOptions: DateConversionOptions = {
							targetFormat: formatChoice.format,
						};

						const conversionResults = convertDates(
							extractionResult.dates,
							conversionOptions,
						);

						if (token.isCancellationRequested) return;

						progress.report({
							increment: 80,
							message: 'Generating results...',
						});

						// Generate conversion report
						const report = generateConversionReport(
							conversionResults,
							formatChoice.label,
						);

						progress.report({ increment: 100, message: 'Opening results...' });

						// Open results
						await openConversionResults(report, deps.notifier);

						deps.telemetry.event('command-convert-success', {
							datesCount: extractionResult.dates.length,
							targetFormat: formatChoice.format,
							convertedCount: conversionResults.length,
						});
					},
				);
			} catch (error) {
				deps.errorHandler.handle({
					category: 'operational',
					originalError:
						error instanceof Error ? error : new Error(String(error)),
					message: 'Failed to convert dates',
					userFriendlyMessage:
						'Date conversion failed. Please check the file format and try again.',
					suggestion: 'Ensure the file contains valid date formats',
					recoverable: true,
					timestamp: new Date(),
				});
			}
		},
	);

	context.subscriptions.push(command);
}

function generateConversionReport(
	results: Array<{
		original: { value: string };
		converted: string;
		format: string;
	}>,
	targetFormat: string,
): string {
	const report = [
		`# Date Conversion Report`,
		'',
		`**Target Format**: ${targetFormat}`,
		`**Total Dates Converted**: ${results.length}`,
		'',
		'## Converted Dates',
		'',
	];

	results.forEach((result, index) => {
		report.push(`### ${index + 1}. ${result.original.value}`);
		report.push(`**Converted**: ${result.converted}`);
		report.push(`**Format**: ${result.format.toUpperCase()}`);
		report.push('');
	});

	// Summary
	report.push('## Summary');
	report.push('');
	report.push(`- **Original dates**: ${results.length}`);
	report.push(`- **Successfully converted**: ${results.length}`);
	report.push(`- **Target format**: ${targetFormat}`);

	if (results.length > 0) {
		const uniqueFormats = new Set(results.map((r) => r.format));
		report.push(
			`- **Output formats**: ${Array.from(uniqueFormats).join(', ')}`,
		);
	}

	return report.join('\n');
}

async function openConversionResults(
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

	notifier.showInfo('Date conversion complete. Results opened in new editor.');
}
