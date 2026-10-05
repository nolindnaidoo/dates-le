import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';
import { replaceDocumentContent } from '../utils/document';
import { sanitizeErrorMessage } from '../utils/errors';
import { hasPosition, onValues } from '../utils/positions';

export function registerDedupeCommand(
	context: vscode.ExtensionContext,
	notifier: Notifier,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.postProcess.dedupe',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				notifier.showWarning(vscode.l10n.t('No active editor found'));
				return;
			}

			try {
				const document = editor.document;
				const lines = document
					.getText()
					.split('\n')
					.map((line) => line.trim())
					.filter((line) => line.length > 0);

				// By date: with positions shown every line is different, and a
				// dedupe over whole lines would remove nothing.
				const deduped = onValues(lines, deduplicateLines);
				const removedCount = lines.length - deduped.length;

				const replaced = await replaceDocumentContent(document, deduped);
				if (!replaced) {
					notifier.showError(
						vscode.l10n.t('Could not deduplicate: the edit was rejected.'),
					);
					return;
				}

				// A date found five times has five positions, and only one can stay.
				const firstOnly = lines.some(hasPosition)
					? '. Each date shows its first position only.'
					: '';
				notifier.showInfo(
					`Removed ${removedCount} duplicate dates (${deduped.length} remaining)${firstOnly}`,
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				notifier.showError(
					`Deduplication failed: ${sanitizeErrorMessage(message)}`,
				);
			}
		},
	);

	context.subscriptions.push(command);
}

function deduplicateLines(lines: readonly string[]): string[] {
	const seen = new Set<string>();
	const deduped: string[] = [];

	for (const line of lines) {
		if (seen.has(line)) {
			continue;
		}

		seen.add(line);
		deduped.push(line);
	}

	return deduped;
}
