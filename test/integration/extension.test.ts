import * as assert from 'node:assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'nolindnaidoo.dates-le';

async function openEditor(
	content: string,
	language: string,
): Promise<vscode.TextEditor> {
	const document = await vscode.workspace.openTextDocument({
		content,
		language,
	});
	return vscode.window.showTextDocument(document);
}

describe('Dates-LE integration', function () {
	this.timeout(30_000);

	it('activates', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(extension, `extension ${EXTENSION_ID} not found`);
		await extension.activate();
		assert.strictEqual(extension.isActive, true);
	});

	it('registers every declared command', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		await extension?.activate();
		const commands = await vscode.commands.getCommands(true);
		for (const id of [
			'dates-le.extractDates',
			'dates-le.postProcess.dedupe',
			'dates-le.postProcess.sort',
			'dates-le.analyze',
			'dates-le.convert',
			'dates-le.filter',
			'dates-le.validate',
			'dates-le.openSettings',
			'dates-le.help',
		]) {
			assert.ok(commands.includes(id), `missing command: ${id}`);
		}
	});

	it('extracts dates from a JSON document into a results document', async () => {
		await openEditor(
			[
				'{',
				'\t"created": "2024-01-15T10:30:00Z",',
				'\t"epoch": 1705312200,',
				'\t"released": "2024-03-01"',
				'}',
			].join('\n'),
			'json',
		);

		await vscode.commands.executeCommand('dates-le.extractDates');

		// Results open in a new plaintext document (side-by-side default).
		const resultDoc = vscode.workspace.textDocuments.find(
			(doc) =>
				doc.languageId === 'plaintext' &&
				doc.getText().includes('2024-01-15T10:30:00Z'),
		);
		assert.ok(resultDoc, 'no results document found');
		const lines = resultDoc.getText().split('\n');
		assert.deepStrictEqual(lines, [
			'2024-01-15T10:30:00Z',
			'1705312200',
			'2024-03-01',
		]);
	});

	it('dedupe removes duplicate lines from the active document', async () => {
		const editor = await openEditor(
			'2024-01-15\n2024-01-16\n2024-01-15\n2024-01-17\n2024-01-16',
			'plaintext',
		);

		await vscode.commands.executeCommand('dates-le.postProcess.dedupe');

		assert.strictEqual(
			editor.document.getText(),
			'2024-01-15\n2024-01-16\n2024-01-17',
		);
	});
});
