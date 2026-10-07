import * as assert from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
			'dates-le.extractWorkspace',
			'dates-le.extractFolder',
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
		// The bare number is a Unix time, and that kind is off by default.
		assert.deepStrictEqual(lines, ['2024-01-15T10:30:00Z', '2024-03-01']);
	});

	it('extracts a Unix time once the kinds setting asks for it', async () => {
		const settings = vscode.workspace.getConfiguration('dates-le');
		await settings.update(
			'kinds',
			['iso', 'simple', 'unix'],
			vscode.ConfigurationTarget.Global,
		);
		try {
			await openEditor('created 2024-01-15T10:30:00Z epoch 1705312200\n', 'plaintext');
			await vscode.commands.executeCommand('dates-le.extractDates');
			const resultDoc = vscode.workspace.textDocuments.find(
				(doc) =>
					doc.languageId === 'plaintext' &&
					doc.getText().split('\n').includes('1705312200'),
			);
			assert.ok(resultDoc, 'no results document held the Unix time');
			assert.deepStrictEqual(resultDoc.getText().split('\n'), [
				'2024-01-15T10:30:00Z',
				'1705312200',
			]);
		} finally {
			await settings.update('kinds', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	it('offers its MCP server to agent mode', async () => {
		// The provider is registered against the id the manifest declares; a
		// mismatch leaves the tools invisible with nothing logged. Assert the
		// declaration and the API the floor was raised for, together — the
		// registration itself is only observable in a real host, which
		// scripts/e2e-vsix.js covers against the installed VSIX.
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		await extension?.activate();

		assert.strictEqual(
			typeof vscode.lm.registerMcpServerDefinitionProvider,
			'function',
			'this VS Code build predates the MCP provider API',
		);

		const providers = extension?.packageJSON.contributes
			.mcpServerDefinitionProviders as { id: string; label: string }[];
		assert.deepStrictEqual(
			providers.map((p) => p.id),
			['dates-le'],
		);
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
	it('extracts the dates of a folder from disk, in time order, one row per moment', async () => {
		const root = mkdtempSync(join(tmpdir(), 'dates-le-extract-'));
		for (const dir of ['docs', 'node_modules', 'generated']) mkdirSync(join(root, dir));
		writeFileSync(join(root, '.gitignore'), 'generated/\n');
		writeFileSync(join(root, 'docs', 'release.md'), 'Shipped 2024-01-15. Announced January 15, 2024.\nSupport ends 2025-12-31.\n');
		writeFileSync(join(root, 'config.ts'), "const launch = '2024-01-15T00:00:00Z';\n");
		writeFileSync(join(root, 'node_modules', 'x.js'), "const skipped = '1999-09-09';\n");
		writeFileSync(join(root, 'generated', 'g.ts'), "const g = '1998-08-08';\n");

		await vscode.commands.executeCommand('dates-le.extractFolder', vscode.Uri.file(root));

		const report = vscode.workspace.textDocuments.find(
			(doc) => doc.languageId === 'markdown' && doc.getText().includes('dates-le-extract-'),
		);
		assert.ok(report, 'no workspace report was opened');
		const text = report.getText();
		assert.match(text, /2 distinct date\(s\), 4 occurrence\(s\) in 2 file\(s\)/);
		assert.ok(text.includes('| `2024-01-15` | `2024-01-15`, `2024-01-15T00:00:00Z`, `January 15, 2024` | 3 | 2 | |'));
		assert.ok(text.includes('| `2025-12-31` | `2025-12-31` | 1 | 1 | `docs/release.md` |'));
		assert.ok(text.indexOf('| `2024-01-15`') < text.indexOf('| `2025-12-31`'));
		assert.ok(!text.includes('1999') && !text.includes('1998'));
		assert.match(text, /1 file\(s\) ignored by \.gitignore/);
	});
});
