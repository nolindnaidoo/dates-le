import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Configuration } from '../types';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { fullDocumentRange } from '../utils/document';
import { sanitizeErrorMessage } from '../utils/errors';
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
				deps.notifier.showWarning(vscode.l10n.t('No active editor found'));
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

				const result = await extractDates(
					document.getText(),
					document.languageId,
				);

				if (!result.success) {
					const errorMessage = result.errors[0]?.message || 'Unknown error';
					deps.notifier.showError(
						`Failed to extract dates: ${sanitizeErrorMessage(errorMessage)}`,
					);
					return;
				}

				if (result.dates.length === 0) {
					deps.notifier.showInfo(
						vscode.l10n.t('No dates found in the current document'),
					);
					return;
				}

				const dateValues = result.dates.map((date) => date.value);

				const opened = await openResults(document, dateValues, config);
				if (!opened) {
					deps.notifier.showError(vscode.l10n.t('Failed to open results'));
					return;
				}

				await handleClipboard(
					dateValues,
					config.copyToClipboardEnabled,
					deps.notifier,
				);

				deps.notifier.showInfo(
					`Extracted ${result.dates.length} dates from document`,
				);

				deps.telemetry.event('extract-success', { count: result.dates.length });
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				deps.notifier.showError(
					`Extraction failed: ${sanitizeErrorMessage(message)}`,
				);
				deps.telemetry.event('extract-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
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
			fullDocumentRange(document),
			dateValues.join('\n'),
		);
		// applyEdit returns false for a rejected edit — a read-only document, or
		// one that changed underneath the command. Returning true regardless made
		// the caller report success over a document it had not touched.
		return await vscode.workspace.applyEdit(edit);
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
			vscode.l10n.t(
				'Results too large for clipboard ({0} characters), skipping clipboard copy',
				clipboardText.length,
			),
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
