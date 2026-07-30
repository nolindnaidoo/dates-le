import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';

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
				notifier.showWarning('No active editor found');
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

				await replaceDocumentContent(document, sorted);

				notifier.showInfo(`Sorted ${sorted.length} dates (${sortOrder.label})`);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				notifier.showError(`Sorting failed: ${message}`);
			}
		},
	);

	context.subscriptions.push(command);
}

async function promptSortOrder(): Promise<SortOption | undefined> {
	return vscode.window.showQuickPick<SortOption>(
		[
			{
				label: 'Chronological (Oldest First)',
				value: 'asc',
			},
			{
				label: 'Reverse Chronological (Newest First)',
				value: 'desc',
			},
			{
				label: 'Alphabetical (A → Z)',
				value: 'alpha-asc',
			},
			{
				label: 'Alphabetical (Z → A)',
				value: 'alpha-desc',
			},
		],
		{
			placeHolder: 'Select sort order',
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

async function replaceDocumentContent(
	document: vscode.TextDocument,
	lines: string[],
): Promise<void> {
	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, fullDocumentRange(document), lines.join('\n'));
	await vscode.workspace.applyEdit(edit);
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
	return new vscode.Range(
		document.positionAt(0),
		document.lineAt(document.lineCount - 1).range.end,
	);
}
