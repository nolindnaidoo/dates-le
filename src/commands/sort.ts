import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export function registerSortCommand(context: vscode.ExtensionContext): void {
	const command = vscode.commands.registerCommand(
		'dates-le.postProcess.sort',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage(
					localize('runtime.sort.no-editor', 'No active editor found'),
				);
				return;
			}

			// Prompt user for sort order
			const sortOrder = await vscode.window.showQuickPick(
				[
					{
						label: localize(
							'runtime.sort.pick.chronological-asc',
							'Chronological (Oldest First)',
						),
						value: 'asc',
					},
					{
						label: localize(
							'runtime.sort.pick.chronological-desc',
							'Reverse Chronological (Newest First)',
						),
						value: 'desc',
					},
					{
						label: localize(
							'runtime.sort.pick.alpha-asc',
							'Alphabetical (A → Z)',
						),
						value: 'alpha-asc',
					},
					{
						label: localize(
							'runtime.sort.pick.alpha-desc',
							'Alphabetical (Z → A)',
						),
						value: 'alpha-desc',
					},
				],
				{
					placeHolder: localize(
						'runtime.sort.pick.placeholder',
						'Select sort order',
					),
				},
			);

			if (!sortOrder) {
				return; // User cancelled
			}

			try {
				const document = editor.document;
				const text = document.getText();
				const lines = text
					.split('\n')
					.map((line) => line.trim())
					.filter((line) => line.length > 0);

				let sorted: string[];
				if (sortOrder.value === 'asc' || sortOrder.value === 'desc') {
					// Try to parse as dates and sort chronologically
					const datesWithOriginal = lines.map((line) => ({
						original: line,
						date: new Date(line),
					}));

					sorted = datesWithOriginal
						.sort((a, b) => {
							const aTime = a.date.getTime();
							const bTime = b.date.getTime();
							// Handle invalid dates by putting them at the end
							if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
							if (Number.isNaN(aTime)) return 1;
							if (Number.isNaN(bTime)) return -1;
							return sortOrder.value === 'asc' ? aTime - bTime : bTime - aTime;
						})
						.map((item) => item.original);
				} else {
					// Alphabetical sort
					sorted = [...lines].sort((a, b) => {
						return sortOrder.value === 'alpha-asc'
							? a.localeCompare(b)
							: b.localeCompare(a);
					});
				}

				// Replace document content
				const edit = new vscode.WorkspaceEdit();
				edit.replace(
					document.uri,
					new vscode.Range(0, 0, document.lineCount, 0),
					sorted.join('\n'),
				);
				await vscode.workspace.applyEdit(edit);

				vscode.window.showInformationMessage(
					localize(
						'runtime.sort.success',
						'Sorted {0} dates ({1})',
						sorted.length,
						sortOrder.label,
					),
				);
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: localize(
								'runtime.error.unknown-fallback',
								'Unknown error occurred',
							);
				vscode.window.showErrorMessage(
					localize('runtime.sort.error', 'Sorting failed: {0}', message),
				);
			}
		},
	);

	context.subscriptions.push(command);
}
