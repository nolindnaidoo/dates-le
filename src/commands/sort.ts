import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractDates } from '../extraction/extract';
import { showProgress } from '../utils/progress';
import { sortDates } from '../utils/sort';

export async function sortDatesCommand(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found');
		return;
	}

	const document = editor.document;
	const content = document.getText();
	const languageId = document.languageId;

	if (!content.trim()) {
		vscode.window.showWarningMessage('Document is empty');
		return;
	}

	const _config = getConfiguration();

	try {
		await showProgress('Sorting dates...', async () => {
			const result = await extractDates(content, languageId);

			if (result.dates.length === 0) {
				vscode.window.showInformationMessage('No dates found to sort');
				return;
			}

			const sortedDates = sortDates([...result.dates], 'chronological');

			// Create a new document with sorted dates
			const sortedContent = sortedDates
				.map((date) => `${date.value} - ${date.context || 'Extracted date'}`)
				.join('\n');

			// Open a new document with sorted results
			const doc = await vscode.workspace.openTextDocument({
				content: sortedContent,
				language: 'plaintext',
			});

			await vscode.window.showTextDocument(doc);

			vscode.window.showInformationMessage(
				`Sorted ${sortedDates.length} dates chronologically`,
			);
		});
	} catch (error) {
		console.error('[Dates-LE] Sort command error:', error);
		vscode.window.showErrorMessage(
			`Failed to sort dates: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}
