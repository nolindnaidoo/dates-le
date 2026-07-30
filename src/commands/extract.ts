import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Configuration } from '../types';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { PerformanceMonitor } from '../utils/performance';
import { formatThroughput } from '../utils/performance';
import { handleSafetyChecks } from '../utils/safety';

export function registerExtractCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
		performanceMonitor: PerformanceMonitor;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.extractDates',
		async () => {
			deps.telemetry.event('command-extract-dates');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning('No active editor found');
				return;
			}

			const document = editor.document;
			const config = getConfiguration();

			const safetyResult = handleSafetyChecks(document, config);
			if (!safetyResult.proceed) {
				deps.notifier.showWarning(safetyResult.message);
				return;
			}

			try {
				deps.statusBar.showProgress('Extracting dates...');

				const timer = deps.performanceMonitor.startTimer('extract-dates');
				const result = await extractDates(
					document.getText(),
					document.languageId,
				);
				const metrics = deps.performanceMonitor.endTimer(timer);

				if (!result.success) {
					const errorMessage = result.errors[0]?.message || 'Unknown error';
					deps.notifier.showError(`Failed to extract dates: ${errorMessage}`);
					return;
				}

				if (result.dates.length === 0) {
					deps.notifier.showInfo('No dates found in the current document');
					return;
				}

				const throughput = calculateThroughput(
					result.dates.length,
					metrics.duration,
				);
				const dateValues = result.dates.map((date) => date.value);

				const opened = await openResults(document, dateValues, config);
				if (!opened) {
					deps.notifier.showError('Failed to open results');
					return;
				}

				await handleClipboard(
					dateValues,
					config.copyToClipboardEnabled,
					deps.notifier,
				);

				deps.notifier.showInfo(
					`Extracted ${result.dates.length} dates (${formatThroughput(throughput)})`,
				);

				deps.telemetry.event('extract-success', { count: result.dates.length });
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				deps.notifier.showError(`Extraction failed: ${message}`);
				deps.telemetry.event('extract-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}

function calculateThroughput(count: number, duration: number): number {
	if (duration <= 0) {
		return 0;
	}

	return (count * 1000) / duration;
}

async function openResults(
	document: vscode.TextDocument,
	dateValues: readonly string[],
	config: Configuration,
): Promise<boolean> {
	try {
		if (config.openResultsSideBySide) {
			const doc = await vscode.workspace.openTextDocument({
				content: dateValues.join('\n'),
				language: 'plaintext',
			});
			await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
			return true;
		}

		const edit = new vscode.WorkspaceEdit();
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			dateValues.join('\n'),
		);
		await vscode.workspace.applyEdit(edit);
		return true;
	} catch {
		return false;
	}
}

async function handleClipboard(
	dateValues: readonly string[],
	enabled: boolean,
	notifier: Notifier,
): Promise<void> {
	if (!enabled) {
		return;
	}

	const clipboardText = dateValues.join('\n');
	const maxClipboardSize = 1000000;

	if (clipboardText.length > maxClipboardSize) {
		notifier.showWarning(
			`Results too large for clipboard (${clipboardText.length} characters), skipping clipboard copy`,
		);
		return;
	}

	try {
		await vscode.env.clipboard.writeText(clipboardText);
	} catch (error) {
		notifier.showWarning(
			`Failed to copy to clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}
