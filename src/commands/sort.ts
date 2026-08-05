import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';
import { replaceDocumentContent } from '../utils/document';
import { sanitizeErrorMessage } from '../utils/errors';

type SortOrder = 'asc' | 'desc' | 'alpha-asc' | 'alpha-desc';

interface SortOption {
	label: string;
	value: SortOrder;
}

export function registerSortCommand(
	context: vscode.ExtensionContext,
	notifier: Notifier,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.postProcess.sort',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				notifier.showWarning(vscode.l10n.t('No active editor found'));
				return;
			}

			const sortOrder = await promptSortOrder();
			if (!sortOrder) {
				return;
			}

			try {
				const document = editor.document;
				const lines = extractNonEmptyLines(document.getText());
				const sorted = sortLines(lines, sortOrder.value);

				const replaced = await replaceDocumentContent(document, sorted);
				if (!replaced) {
					notifier.showError(
						vscode.l10n.t('Could not sort: the edit was rejected.'),
					);
					return;
				}

				notifier.showInfo(
					vscode.l10n.t(
						'Sorted {0} dates ({1})',
						sorted.length,
						sortOrder.label,
					),
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				notifier.showError(
					vscode.l10n.t('Sorting failed: {0}', sanitizeErrorMessage(message)),
				);
			}
		},
	);

	context.subscriptions.push(command);
}

async function promptSortOrder(): Promise<SortOption | undefined> {
	return vscode.window.showQuickPick<SortOption>(
		[
			{
				label: vscode.l10n.t('Chronological (Oldest First)'),
				value: 'asc',
			},
			{
				label: vscode.l10n.t('Reverse Chronological (Newest First)'),
				value: 'desc',
			},
			{
				label: vscode.l10n.t('Alphabetical (A → Z)'),
				value: 'alpha-asc',
			},
			{
				label: vscode.l10n.t('Alphabetical (Z → A)'),
				value: 'alpha-desc',
			},
		],
		{
			placeHolder: vscode.l10n.t('Select sort order'),
		},
	);
}

function extractNonEmptyLines(text: string): string[] {
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function sortLines(lines: string[], sortOrder: SortOrder): string[] {
	if (sortOrder === 'asc' || sortOrder === 'desc') {
		return sortChronologically(lines, sortOrder);
	}

	return sortAlphabetically(lines, sortOrder);
}

function sortChronologically(lines: string[], sortOrder: SortOrder): string[] {
	const datesWithOriginal = lines.map((line) => ({
		original: line,
		date: new Date(line),
	}));

	return datesWithOriginal
		.sort((a, b) => {
			const aTime = a.date.getTime();
			const bTime = b.date.getTime();

			if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
				return 0;
			}

			if (Number.isNaN(aTime)) {
				return 1;
			}

			if (Number.isNaN(bTime)) {
				return -1;
			}

			return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
		})
		.map((item) => item.original);
}

function sortAlphabetically(lines: string[], sortOrder: SortOrder): string[] {
	return [...lines].sort((a, b) => {
		return sortOrder === 'alpha-asc' ? a.localeCompare(b) : b.localeCompare(a);
	});
}
