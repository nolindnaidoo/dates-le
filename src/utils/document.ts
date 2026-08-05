import * as vscode from 'vscode';

/**
 * Document-rewriting helpers shared by the in-place commands (sort, dedupe,
 * extract). Each of those carried its own byte-identical copy; they were
 * verified identical before being merged here, but three copies of the edit
 * that replaces the user's entire document is three places to get it wrong.
 */

/** The range covering the whole document, start to final character. */
export function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
	return new vscode.Range(
		document.positionAt(0),
		document.lineAt(document.lineCount - 1).range.end,
	);
}

/**
 * Replace the document's entire contents with `lines`.
 *
 * Returns false when the workspace rejected the edit — a read-only document,
 * or one that changed underneath the command. Callers must not announce a
 * result without checking it: the document still holds its original text.
 */
export async function replaceDocumentContent(
	document: vscode.TextDocument,
	lines: string[],
): Promise<boolean> {
	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, fullDocumentRange(document), lines.join('\n'));
	return await vscode.workspace.applyEdit(edit);
}
