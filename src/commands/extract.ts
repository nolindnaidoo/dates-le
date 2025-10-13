import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { handleSafetyChecks } from '../utils/safety';

export function registerExtractCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
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

			// Safety checks
			const safetyResult = handleSafetyChecks(document, config);
			if (!safetyResult.proceed) {
				deps.notifier.showWarning(safetyResult.message);
				return;
			}

			try {
				deps.statusBar.showProgress('Extracting dates...');

				const result = await extractDates(
					document.getText(),
					document.languageId,
				);

				if (!result.success) {
					deps.notifier.showError(
						`Failed to extract dates: ${result.errors[0]?.message || 'Unknown error'}`,
					);
					return;
				}

				if (result.dates.length === 0) {
					deps.notifier.showInfo('No dates found in the current document');
					return;
				}

				// Output dates in original format (one per line)
				const dateValues = result.dates.map((date) => date.value);

				// Open results with enhanced error handling
				try {
					if (config.openResultsSideBySide) {
						const doc = await vscode.workspace.openTextDocument({
							content: dateValues.join('\n'),
							language: 'plaintext',
						});
						await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
					} else {
						// Replace current selection or entire document
						const edit = new vscode.WorkspaceEdit();
						edit.replace(
							document.uri,
							new vscode.Range(0, 0, document.lineCount, 0),
							dateValues.join('\n'),
						);
						await vscode.workspace.applyEdit(edit);
					}
				} catch (error) {
					deps.notifier.showError(
						`Failed to open results: ${error instanceof Error ? error.message : 'Unknown error'}`,
					);
					return;
				}

				// Copy to clipboard if enabled
				if (config.copyToClipboardEnabled) {
					try {
						const clipboardText = dateValues.join('\n');
						// Check clipboard text length to prevent memory issues
						if (clipboardText.length > 1000000) {
							// 1MB limit
							deps.notifier.showWarning(
								`Results too large for clipboard (${clipboardText.length} characters), skipping clipboard copy`,
							);
						} else {
							await vscode.env.clipboard.writeText(clipboardText);
							deps.notifier.showInfo(
								`Extracted ${result.dates.length} dates and copied to clipboard`,
							);
						}
					} catch (error) {
						deps.notifier.showWarning(
							`Failed to copy to clipboard: ${
								error instanceof Error ? error.message : 'Unknown error'
							}`,
						);
						deps.notifier.showInfo(`Extracted ${result.dates.length} dates`);
					}
				} else {
					deps.notifier.showInfo(`Extracted ${result.dates.length} dates`);
				}

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
