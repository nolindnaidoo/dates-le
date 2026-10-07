import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	_clipboardText,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToOpenDialog,
	_setConfig,
	_setWorkspaceFiles,
	_shownMessages,
	Uri,
	workspace,
} from '../__mocks__/vscode';
import { createTelemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import { createStatusBar } from '../ui/statusBar';
import {
	calendarLabel,
	registerExtractWorkspaceCommands,
} from './extractWorkspace';

const TREE = {
	'/w/docs/release.md':
		'Shipped 2024-01-15. Announced January 15, 2024.\nSupport ends 2025-12-31.\n',
	'/w/src/config.ts': "const launch = '2024-01-15T00:00:00Z';\n",
	'/w/data/events.json': '{\n  "start": "2024-03-01T10:30:00+02:00"\n}\n',
	'/w/node_modules/x.js': "const skipped = '1999-09-09';\n",
	'/w/logo.png': '2001-01-01',
};

async function runCommand(id: string, ...args: unknown[]): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler(...args);
}

function report(): string {
	const last = _openedDocuments().at(-1);
	if (!last) throw new Error('no report was opened');
	return last.getText();
}

function open(files: Record<string, string> = TREE): void {
	_setWorkspaceFiles(files);
	workspace.workspaceFolders = [{ uri: Uri.file('/w'), name: 'w', index: 0 }];
}

beforeEach(() => {
	_resetMockState();
	const context = { subscriptions: [] as Array<{ dispose(): void }> } as never;
	registerExtractWorkspaceCommands(context, {
		telemetry: createTelemetry(),
		notifier: createNotifier(),
		statusBar: createStatusBar(context),
	});
});

describe('what a written date is called', () => {
	const at = (iso: string) => Date.parse(iso);

	it('names a date with a zone, or a Unix time, as a moment in UTC', () => {
		expect(
			calendarLabel('2024-03-01T10:30:00+02:00', at('2024-03-01T08:30:00Z')),
		).toBe('2024-03-01T08:30:00Z');
		expect(
			calendarLabel(
				'Mon, 15 Jan 2024 10:30:00 GMT',
				at('2024-01-15T10:30:00Z'),
			),
		).toBe('2024-01-15T10:30:00Z');
		expect(calendarLabel('1705314600', at('2024-01-15T10:30:00Z'))).toBe(
			'2024-01-15T10:30:00Z',
		);
		// Midnight UTC is the day.
		expect(
			calendarLabel('2024-01-15T00:00:00Z', at('2024-01-15T00:00:00Z')),
		).toBe('2024-01-15');
	});

	it('names a date without a zone by what was written, whichever midnight it was resolved to', () => {
		// Resolved to midnight UTC, as an ISO date is.
		expect(calendarLabel('2024-01-15', at('2024-01-15T00:00:00Z'))).toBe(
			'2024-01-15',
		);
		// Resolved to local midnight, as a date in words is. The local day is the day.
		const local = new Date(2024, 0, 15).getTime();
		expect(calendarLabel('January 15, 2024', local)).toBe('2024-01-15');
		expect(calendarLabel('01/15/2024', local)).toBe('2024-01-15');
	});

	it('names a time without a zone by its clock reading, and gives it no Z', () => {
		const local = new Date(2024, 0, 15, 10, 30, 0).getTime();
		expect(calendarLabel('Jan 15, 2024 10:30', local)).toBe(
			'2024-01-15T10:30:00',
		);
	});
});

describe('dates-le.extractWorkspace and dates-le.extractFolder', () => {
	it('warns when no workspace is open', async () => {
		_setConfig('dates-le.notificationsLevel', 'all');
		await runCommand('dates-le.extractWorkspace');
		expect(_shownMessages()[0]).toMatchObject({ kind: 'warning' });
		expect(_openedDocuments()).toHaveLength(0);
	});

	it('lists each date once across its spellings, in time order', async () => {
		_setConfig('dates-le.notificationsLevel', 'all');
		open();
		await runCommand('dates-le.extractWorkspace');

		const text = report();
		expect(text).toContain(
			'3 file(s) read · 3 distinct date(s), 5 occurrence(s) in 3 file(s)',
		);
		expect(text.split('\n').filter((line) => line.startsWith('| `'))).toEqual([
			// Three spellings of one date are one row.
			'| `2024-01-15` | `2024-01-15`, `2024-01-15T00:00:00Z`, `January 15, 2024` | 3 | 2 | |',
			// A moment with a time is named in UTC, and its offset stays in the spelling.
			'| `2024-03-01T08:30:00Z` | `2024-03-01T10:30:00+02:00` | 1 | 1 | `/w/data/events.json` |',
			'| `2025-12-31` | `2025-12-31` | 1 | 1 | `/w/docs/release.md` |',
		]);
		// Only the repeated date has a section.
		expect(text.match(/^## .*$/gm)).toEqual(['## `2024-01-15` (3)']);
		expect(text).toContain('- `/w/docs/release.md` (2)\n- `/w/src/config.ts`');
		// Positions are off by default here.
		expect(text).not.toMatch(/\*\*\d+:\d+\*\*/);
		// Left out by the built-in list, and a .png is never opened.
		expect(text).not.toContain('1999');
		expect(text).not.toContain('2001');
		expect(_shownMessages().at(-1)?.message).toBe(
			'3 distinct date(s), 5 occurrence(s) in 3 file(s)',
		);
	});

	it('reads an ambiguous date the way the dateOrder setting says', async () => {
		open({ '/w/a.txt': 'due 03/04/2024\n' });
		await runCommand('dates-le.extractWorkspace');
		expect(report()).toContain('| `2024-03-04` | `03/04/2024` |');

		_setConfig('dates-le.dateOrder', 'dmy');
		await runCommand('dates-le.extractWorkspace');
		expect(report()).toContain('| `2024-04-03` | `03/04/2024` |');
	});

	it('extracts only the kinds the kinds setting names', async () => {
		open({ '/w/a.log': 'at 1705314645 on 2024-01-15\n' });
		await runCommand('dates-le.extractWorkspace');
		expect(report()).toContain('1 distinct date(s), 1 occurrence(s)');
		expect(report()).not.toContain('1705314645');

		_setConfig('dates-le.kinds', ['simple', 'unix']);
		await runCommand('dates-le.extractWorkspace');
		expect(report()).toContain('| `2024-01-15T10:30:45Z` | `1705314645` |');
		expect(report()).toContain('2 distinct date(s), 2 occurrence(s)');
	});

	it('places every occurrence when positions are on, and decides the copy separately', async () => {
		open();
		_setConfig('dates-le.showPositions', true);
		_setConfig('dates-le.copyToClipboardEnabled', true);
		await runCommand('dates-le.extractWorkspace');

		expect(report()).toContain(
			'- `/w/docs/release.md` · **1:9**, **1:31**\n- `/w/src/config.ts` · **1:17**',
		);
		expect(report()).toContain('`/w/docs/release.md` · **2:14** |');
		// The clipboard has its own setting, and that one is still off.
		expect(_clipboardText()).toContain('- `/w/docs/release.md` (2)');
		expect(_clipboardText()).not.toMatch(/\*\*\d+:\d+\*\*/);
	});

	it('scans only the folder it is handed, and names files relative to it', async () => {
		open();
		await runCommand('dates-le.extractFolder', Uri.file('/w/docs'));

		expect(report()).toContain(
			'`/w/docs` · 1 file(s) read · 2 distinct date(s), 3 occurrence(s) in 1 file(s)',
		);
		expect(report()).toContain('- `release.md` (2)');
	});

	it('asks for a folder from the palette, and does nothing when none is picked', async () => {
		open();
		_respondToOpenDialog(() => undefined);
		await runCommand('dates-le.extractFolder');
		expect(_openedDocuments()).toHaveLength(0);

		_respondToOpenDialog(() => [Uri.file('/w/src')]);
		await runCommand('dates-le.extractFolder');
		expect(report()).toContain('`/w/src` · 1 file(s) read');
	});

	it('stops at the results limit and says the rest was not read', async () => {
		open();
		_setConfig('dates-le.workspace.scanMaxResults', 1);
		await runCommand('dates-le.extractWorkspace');

		expect(report()).toContain(
			'1 distinct date(s), 1 occurrence(s) in 1 file(s)',
		);
		expect(report()).toContain(
			'> The results limit was reached. The rest of the files were not read.',
		);
	});

	it('says when a folder holds no dates', async () => {
		open({ '/w/a.txt': 'nothing here\n' });
		await runCommand('dates-le.extractWorkspace');
		expect(report()).toContain('No dates found.');
	});

	it('prints the report the README shows as its sample', async () => {
		open();
		_setConfig('dates-le.showPositions', true);
		await runCommand('dates-le.extractFolder', Uri.file('/w'));

		const readme = readFileSync(
			join(__dirname, '..', '..', 'README.md'),
			'utf8',
		);
		const shown = report()
			.split('\n')
			.filter(
				(line) =>
					line.startsWith('- ') ||
					line.startsWith('| `') ||
					line.startsWith('## '),
			);
		expect(shown).toHaveLength(6);
		for (const line of shown) expect(readme).toContain(line);
		expect(readme).toContain(
			'3 file(s) read · 3 distinct date(s), 5 occurrence(s) in 3 file(s)',
		);
	});
});
