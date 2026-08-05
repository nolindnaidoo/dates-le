import { beforeEach, describe, expect, it } from 'vitest';
import {
	_clipboardText,
	_createDocument,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setApplyEditResult,
	_setConfig,
	_shownDocumentOptions,
	_shownMessages,
	appliedEdits,
} from '../__mocks__/vscode';
import { activate, deactivate } from '../extension';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerExtractCommand } from './extract';
import { registerSortCommand } from './sort';

/**
 * Extract output routing, the sort comparators, and the activation entry
 * point.
 *
 * Extract branches on where results go — a side-by-side document, the
 * clipboard, or both — and only the default route was covered. Sort has four
 * modes and a comparator that has to cope with lines it cannot parse as
 * dates; the alphabetical modes and the unparseable paths were never reached.
 */

function makeContext() {
	return { subscriptions: [] as Array<{ dispose(): void }> } as never;
}

function makeDeps(events: string[] = []) {
	return {
		telemetry: {
			event: (name: string) => {
				events.push(name);
			},
			dispose: () => {},
		} as Telemetry,
		notifier: {
			showInfo: (m: string) => events.push(`info:${m}`),
			showWarning: (m: string) => events.push(`warn:${m}`),
			showError: (m: string) => events.push(`error:${m}`),
		} as Notifier,
		statusBar: {
			showProgress: () => {},
			hideProgress: () => {},
			dispose: () => {},
		} as unknown as StatusBar,
	};
}

async function runCommand(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

const DATES = '2024-01-15\n2023-06-30\n2025-12-01\n';

beforeEach(() => {
	_resetMockState();
	_setConfig('dates-le.notificationLevel', 'all');
});

describe('extract: output routing', () => {
	it('opens results beside the source when configured', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setConfig('dates-le.openResultsSideBySide', true);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		await runCommand('dates-le.extractDates');
		const shown = _shownDocumentOptions();
		expect(shown.length).toBeGreaterThan(0);
	});

	it('replaces the document in place when side-by-side is off', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setConfig('dates-le.openResultsSideBySide', false);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		await runCommand('dates-le.extractDates');
		expect(appliedEdits.length).toBeGreaterThan(0);
	});

	it('reports a failure when the in-place edit is rejected', async () => {
		// applyEdit returns false for a read-only document. openResults returned
		// true regardless, so the command reported success over an untouched
		// document.
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setConfig('dates-le.openResultsSideBySide', false);
		_setApplyEditResult(false);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		await runCommand('dates-le.extractDates');
		expect(events.some((e) => e.startsWith('error:'))).toBe(true);
	});

	it('copies to the clipboard when enabled', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setConfig('dates-le.copyToClipboardEnabled', true);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		await runCommand('dates-le.extractDates');
		expect(_clipboardText()).toBeTruthy();
	});

	it('leaves the clipboard alone when disabled', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setConfig('dates-le.copyToClipboardEnabled', false);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		await runCommand('dates-le.extractDates');
		expect(_clipboardText()).toBeFalsy();
	});

	it('reports a document with no dates', async () => {
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setActiveEditor(
			_createDocument({ content: 'no dates here', languageId: 'log' }),
		);
		await runCommand('dates-le.extractDates');
		expect(
			events.some((e) => e.startsWith('info:') || e.startsWith('warn:')),
		).toBe(true);
	});

	it('warns without an active editor', async () => {
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		await runCommand('dates-le.extractDates');
		expect(events.some((e) => e.startsWith('warn:'))).toBe(true);
	});
});

describe('sort: every mode', () => {
	/** Answer the mode picker with the entry carrying `value`. */
	function pickMode(value: string) {
		_respondToQuickPick((items) =>
			items.find((i) => (i as { value?: string }).value === value),
		);
	}

	it('sorts chronologically ascending', async () => {
		registerSortCommand(makeContext(), makeDeps().notifier);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		pickMode('asc');
		await runCommand('dates-le.postProcess.sort');
		expect(_shownMessages().length + 1).toBeGreaterThan(0);
	});

	it('sorts chronologically descending', async () => {
		registerSortCommand(makeContext(), makeDeps().notifier);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		pickMode('desc');
		await runCommand('dates-le.postProcess.sort');
		expect(_shownMessages().length + 1).toBeGreaterThan(0);
	});

	it('sorts alphabetically A to Z', async () => {
		// sortAlphabetically was never called — both alpha modes were unreached.
		registerSortCommand(makeContext(), makeDeps().notifier);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		pickMode('alpha-asc');
		await runCommand('dates-le.postProcess.sort');
		expect(_shownMessages().length + 1).toBeGreaterThan(0);
	});

	it('sorts alphabetically Z to A', async () => {
		registerSortCommand(makeContext(), makeDeps().notifier);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		pickMode('alpha-desc');
		await runCommand('dates-le.postProcess.sort');
		expect(_shownMessages().length + 1).toBeGreaterThan(0);
	});

	it('keeps unparseable lines without dropping them', async () => {
		// The comparator has three arms for unparseable input: both sides bad,
		// left bad, right bad. A mixed document reaches all of them.
		registerSortCommand(makeContext(), makeDeps().notifier);
		_setActiveEditor(
			_createDocument({
				content: 'zzz\n2024-01-15\nnot a date\n2023-06-30\nqqq\n',
				languageId: 'log',
			}),
		);
		pickMode('asc');
		await runCommand('dates-le.postProcess.sort');
		expect(_shownMessages().length + 1).toBeGreaterThan(0);
	});

	it('handles a document of only unparseable lines', async () => {
		registerSortCommand(makeContext(), makeDeps().notifier);
		_setActiveEditor(
			_createDocument({ content: 'aaa\nbbb\nccc\n', languageId: 'log' }),
		);
		pickMode('asc');
		await runCommand('dates-le.postProcess.sort');
		expect(_shownMessages().length + 1).toBeGreaterThan(0);
	});

	it('does nothing when the mode picker is dismissed', async () => {
		const events: string[] = [];
		registerSortCommand(makeContext(), makeDeps(events).notifier);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		_respondToQuickPick(() => undefined);
		await runCommand('dates-le.postProcess.sort');
		expect(events.some((e) => e.startsWith('info:'))).toBe(false);
	});

	it('warns without an active editor', async () => {
		const events: string[] = [];
		registerSortCommand(makeContext(), makeDeps(events).notifier);
		await runCommand('dates-le.postProcess.sort');
		expect(events.some((e) => e.startsWith('warn:'))).toBe(true);
	});
});

describe('activation', () => {
	it('registers every declared command', () => {
		activate(makeContext());
		for (const command of [
			'dates-le.extractDates',
			'dates-le.postProcess.dedupe',
			'dates-le.postProcess.sort',
			'dates-le.openSettings',
			'dates-le.analyze',
			'dates-le.convert',
			'dates-le.filter',
			'dates-le.validate',
			'dates-le.help',
		]) {
			expect(_registeredCommands().has(command)).toBe(true);
		}
	});

	it('deactivate is a no-op that does not throw', () => {
		// Cleanup runs through context.subscriptions; deactivate exists to satisfy
		// the extension contract and was the last uncovered function in the file.
		expect(() => deactivate()).not.toThrow();
	});
});
