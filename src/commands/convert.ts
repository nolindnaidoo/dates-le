import * as vscode from 'vscode';
import {
	convertDatesWithSkipped,
	type DateConversionOptions,
	getAvailableFormats,
} from '../conversion/dateConverter';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { sanitizeErrorMessage } from '../utils/errors';

export function registerConvertCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.convert',
		async () => {
			deps.telemetry.event('command-convert');

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
						title: vscode.l10n.t('Converting dates...'),
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
							deps.notifier.showInfo(
								vscode.l10n.t('No dates found to convert'),
							);
							return;
						}

						progress.report({
							increment: 30,
							message: vscode.l10n.t('Selecting target format...'),
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
								placeHolder: vscode.l10n.t('Select target date format'),
								title: vscode.l10n.t('Convert Dates - Select Format'),
							},
						);

						if (token.isCancellationRequested || !formatChoice) return;

						progress.report({
							increment: 50,
							message: vscode.l10n.t('Converting dates...'),
						});

						// Convert dates
						const conversionOptions: DateConversionOptions = {
							targetFormat: formatChoice.format,
						};

						const { results: conversionResults, skipped } =
							convertDatesWithSkipped(
								extractionResult.dates,
								conversionOptions,
							);

						if (token.isCancellationRequested) return;

						progress.report({
							increment: 80,
							message: vscode.l10n.t('Generating results...'),
						});

						// Generate conversion report
						const report = generateConversionReport(
							conversionResults,
							formatChoice.label,
							skipped.length,
						);

						progress.report({
							increment: 100,
							message: vscode.l10n.t('Opening results...'),
						});

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
				const message = error instanceof Error ? error.message : String(error);
				deps.notifier.showError(
					`Failed to convert dates: ${sanitizeErrorMessage(message)}`,
				);
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
	skippedCount = 0,
): string {
	const report = [
		`# Date Conversion Report`,
		'',
		`**Target Format**: ${targetFormat}`,
		`**Total Dates Converted**: ${results.length}`,
		// Without this line the count simply came up short and the only record
		// of the failures was a console.warn nobody sees.
		...(skippedCount > 0
			? [`**Skipped (could not be converted)**: ${skippedCount}`]
			: []),
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

	notifier.showInfo(
		vscode.l10n.t('Date conversion complete. Results opened in new editor.'),
	);
}
