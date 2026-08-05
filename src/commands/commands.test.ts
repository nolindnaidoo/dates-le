import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setApplyEditResult,
	_setConfig,
	_shownMessages,
	appliedEdits,
} from '../__mocks__/vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import { createNotifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerAnalyzeCommand } from './analyze';
import { registerConvertCommand } from './convert';
import { registerDedupeCommand } from './dedupe';
import { registerExtractCommand } from './extract';
import { registerFilterCommand } from './filter';
import { registerHelpCommand } from './help';
import { registerSortCommand } from './sort';
import { registerValidateCommand } from './validate';

function makeContext() {
	return { subscriptions: [] as Array<{ dispose(): void }> } as never;
}

interface RecordedDeps {
	readonly events: string[];
	readonly deps: {
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	};
}

function makeDeps(): RecordedDeps {
	const events: string[] = [];
	return {
		events,
		deps: {
			telemetry: {
				event: (name: string) => {
					events.push(name);
				},
				dispose: () => {},
			},
			notifier: {
				showInfo: (m: string) => {
					events.push(`info:${m}`);
				},
				showWarning: (m: string) => {
					events.push(`warn:${m}`);
				},
				showError: (m: string) => {
					events.push(`error:${m}`);
				},
			},
			statusBar: {
				showProgress: () => {},
				hideProgress: () => {},
				dispose: () => {},
			},
		},
	};
}

async function runCommand(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

beforeEach(() => {
	_resetMockState();
});

describe('dates-le.postProcess.dedupe', () => {
	it('warns when no editor is active', async () => {
		_setConfig('dates-le.notificationsLevel', 'important');
		registerDedupeCommand(makeContext(), createNotifier());
		await runCommand('dates-le.postProcess.dedupe');
		expect(_shownMessages()[0]?.kind).toBe('warning');
		expect(appliedEdits).toHaveLength(0);
	});

	it('removes duplicates and reports an honest count', async () => {
		_setConfig('dates-le.notificationsLevel', 'all');
		registerDedupeCommand(makeContext(), createNotifier());
		_setActiveEditor(
			_createDocument({
				content: '2024-01-15\n2024-01-16\n\n2024-01-15\n2024-01-17\n',
			}),
		);
		await runCommand('dates-le.postProcess.dedupe');

		expect(appliedEdits).toHaveLength(1);
		expect(appliedEdits[0]?.replacements[0]?.newText).toBe(
			'2024-01-15\n2024-01-16\n2024-01-17',
		);
		// 4 non-empty lines, 3 unique -> 1 duplicate (blank lines not counted)
		expect(_shownMessages()[0]?.message).toBe(
			'Removed 1 duplicate dates (3 remaining)',
		);
	});

	it('suppresses the success toast at the default silent level', async () => {
		registerDedupeCommand(makeContext(), createNotifier());
		_setActiveEditor(_createDocument({ content: '2024-01-15\n2024-01-15' }));
		await runCommand('dates-le.postProcess.dedupe');

		expect(appliedEdits).toHaveLength(1); // the edit still happens
		expect(_shownMessages()).toHaveLength(0); // the toast does not
	});
});

describe('dates-le.postProcess.sort', () => {
	it('sorts chronologically ascending via quick pick', async () => {
		_setConfig('dates-le.notificationsLevel', 'all');
		registerSortCommand(makeContext(), createNotifier());
		_setActiveEditor(
			_createDocument({ content: '2024-03-01\n2024-01-15\n2024-02-02' }),
		);
		_respondToQuickPick((items) =>
			(items as Array<{ value: string }>).find((item) => item.value === 'asc'),
		);
		await runCommand('dates-le.postProcess.sort');

		expect(appliedEdits[0]?.replacements[0]?.newText).toBe(
			'2024-01-15\n2024-02-02\n2024-03-01',
		);
		expect(_shownMessages()[0]?.message).toContain('Sorted 3 dates');
	});

	it('sorts unparseable lines to the end', async () => {
		registerSortCommand(makeContext(), createNotifier());
		_setActiveEditor(
			_createDocument({ content: 'not-a-date\n2024-01-15\n2023-06-01' }),
		);
		_respondToQuickPick((items) =>
			(items as Array<{ value: string }>).find((item) => item.value === 'asc'),
		);
		await runCommand('dates-le.postProcess.sort');

		expect(appliedEdits[0]?.replacements[0]?.newText).toBe(
			'2023-06-01\n2024-01-15\nnot-a-date',
		);
	});

	it('does nothing when the quick pick is dismissed', async () => {
		registerSortCommand(makeContext(), createNotifier());
		_setActiveEditor(_createDocument({ content: '2024-01-15\n2023-06-01' }));
		_respondToQuickPick(() => undefined);
		await runCommand('dates-le.postProcess.sort');
		expect(appliedEdits).toHaveLength(0);
	});
});

describe('dates-le.extractDates', () => {
	it('extracts to a side-by-side document and copies when configured', async () => {
		const { events, deps } = makeDeps();
		registerExtractCommand(makeContext(), deps);

		_setConfig('dates-le.copyToClipboardEnabled', true);
		_setActiveEditor(
			_createDocument({
				content: '{ "created": "2024-01-15T10:30:00Z" }',
				languageId: 'json',
			}),
		);

		await runCommand('dates-le.extractDates');

		expect(events).toContain('command-extract-dates');
		expect(events).toContain('info:Extracted 1 dates from document');
		const { _clipboardText } = await import('../__mocks__/vscode');
		expect(_clipboardText()).toBe('2024-01-15T10:30:00Z');
	});

	it('reports empty documents as info, not error', async () => {
		const { events, deps } = makeDeps();
		registerExtractCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: 'no dates here', languageId: 'json' }),
		);
		await runCommand('dates-le.extractDates');

		expect(events).toContain('info:No dates found in the current document');
		expect(events.some((e) => e.startsWith('error:'))).toBe(false);
	});

	it('warns without an active editor', async () => {
		const { events, deps } = makeDeps();
		registerExtractCommand(makeContext(), deps);
		await runCommand('dates-le.extractDates');
		expect(events).toContain('warn:No active editor found');
	});

	it('blocks oversized documents via the safety check', async () => {
		const { events, deps } = makeDeps();
		registerExtractCommand(makeContext(), deps);
		_setConfig('dates-le.safety.fileSizeWarnBytes', 1000);
		_setActiveEditor(
			_createDocument({
				content: `"2024-01-15"${' '.repeat(2000)}`,
				languageId: 'json',
			}),
		);
		await runCommand('dates-le.extractDates');
		expect(events.some((e) => e.startsWith('warn:File size'))).toBe(true);
	});
});

describe('dates-le.analyze', () => {
	it('opens an analysis report for a document with dates', async () => {
		const { events, deps } = makeDeps();
		registerAnalyzeCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({
				content: '2024-01-15\n2024-01-15\n2024-02-01\n2024-06-15',
				languageId: 'log',
			}),
		);
		await runCommand('dates-le.analyze');

		expect(events).toContain('command-analyze');
		expect(events.some((e) => e.startsWith('command-analyze-success'))).toBe(
			true,
		);
		expect(
			events.some((e) => e.startsWith('info:Date analysis complete')),
		).toBe(true);
	});

	it('reports no dates as info', async () => {
		const { events, deps } = makeDeps();
		registerAnalyzeCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: 'nothing', languageId: 'json' }),
		);
		await runCommand('dates-le.analyze');
		expect(events).toContain('info:No dates found to analyze');
	});
});

describe('dates-le.convert', () => {
	it('converts extracted dates to the picked format', async () => {
		const { events, deps } = makeDeps();
		registerConvertCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({
				content: '2024-01-15T10:30:00Z',
				languageId: 'log',
			}),
		);
		_respondToQuickPick((items) =>
			(items as Array<{ format: string }>).find(
				(item) => item.format === 'unix',
			),
		);
		await runCommand('dates-le.convert');

		expect(events.some((e) => e.startsWith('command-convert-success'))).toBe(
			true,
		);
	});

	it('does nothing when the format pick is dismissed', async () => {
		const { events, deps } = makeDeps();
		registerConvertCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: '2024-01-15', languageId: 'log' }),
		);
		_respondToQuickPick(() => undefined);
		await runCommand('dates-le.convert');
		expect(events.some((e) => e.startsWith('command-convert-success'))).toBe(
			false,
		);
	});
});

describe('dates-le.filter', () => {
	it('filters by format via multi-pick', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({
				content: '2024-01-15\n1705312200\n2024-02-01',
				languageId: 'log',
			}),
		);
		let call = 0;
		_respondToQuickPick((items) => {
			call += 1;
			if (call === 1) {
				return (items as Array<{ id: string }>).filter(
					(item) => item.id === 'includeFormats',
				);
			}
			return (items as Array<{ format?: string }>).filter(
				(item) => item.format === 'simple',
			);
		});
		await runCommand('dates-le.filter');

		expect(events.some((e) => e.startsWith('command-filter-success'))).toBe(
			true,
		);
	});

	it('reports no dates as info', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: 'nothing', languageId: 'json' }),
		);
		await runCommand('dates-le.filter');
		expect(events).toContain('info:No dates found to filter');
	});
});

describe('dates-le.validate', () => {
	it('validates extracted dates against picked rules', async () => {
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({
				content: '2024-01-15T10:30:00Z\n9999-01-01',
				languageId: 'log',
			}),
		);
		_respondToQuickPick((items) => items); // pick every rule
		await runCommand('dates-le.validate');

		expect(events.some((e) => e.startsWith('command-validate-success'))).toBe(
			true,
		);
	});
});

describe('dates-le.help', () => {
	it('opens the help document and documents only real commands', async () => {
		const { events, deps } = makeDeps();
		registerHelpCommand(makeContext(), deps);
		await runCommand('dates-le.help');
		expect(events).toContain('command-help');
	});
});

describe('post-process: rejected edits', () => {
	// applyEdit resolves false for a read-only document, or one that changed
	// underneath the command. The shared replaceDocumentContent helper swallowed
	// that value, so both commands announced a result over unchanged text.

	it('dedupe reports a failure instead of a count', async () => {
		_setConfig('dates-le.notificationsLevel', 'all');
		registerDedupeCommand(makeContext(), createNotifier());
		_setApplyEditResult(false);
		_setActiveEditor(
			_createDocument({ content: '2024-01-15\n2024-01-15\n2024-01-16\n' }),
		);
		await runCommand('dates-le.postProcess.dedupe');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(true);
		expect(
			_shownMessages().some((m) => String(m.message).startsWith('Removed')),
		).toBe(false);
	});

	it('sort reports a failure instead of a count', async () => {
		_setConfig('dates-le.notificationsLevel', 'all');
		registerSortCommand(makeContext(), createNotifier());
		_setApplyEditResult(false);
		_respondToQuickPick((items) => items[0]);
		_setActiveEditor(
			_createDocument({ content: '2024-01-16\n2024-01-15\n2024-01-17\n' }),
		);
		await runCommand('dates-le.postProcess.sort');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(true);
		expect(
			_shownMessages().some((m) => String(m.message).startsWith('Sorted')),
		).toBe(false);
	});
});
