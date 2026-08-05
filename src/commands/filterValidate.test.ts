import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_registeredCommands,
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
	_setActiveEditor,
	_setConfig,
} from '../__mocks__/vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerAnalyzeCommand } from './analyze';
import { registerFilterCommand } from './filter';
import { registerValidateCommand } from './validate';

/**
 * The filter and validate commands, which were the two least-covered files in
 * this repo.
 *
 * Both are driven almost entirely by multi-select quick picks — the filter
 * kinds to apply, the validation rules to run — and every branch past the
 * first is reachable only by answering those picks. The existing suite covers
 * the no-editor and no-dates cases, so none of the real work was exercised.
 *
 * Selections are matched on `choice.id` rather than the label, which is what
 * makes these commands translation-safe; the tests pick by id for the same
 * reason.
 */

function makeContext() {
	return { subscriptions: [] as Array<{ dispose(): void }> } as never;
}

function makeDeps() {
	const events: string[] = [];
	const deps = {
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
	return { events, deps };
}

async function runCommand(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

/** Pick the multi-select entries whose `id` is in `ids`. */
function pickByIds(ids: readonly string[]) {
	return (items: unknown[]): unknown =>
		items.filter((i) => ids.includes(String((i as { id?: string }).id)));
}

const DATES = '2024-01-15\n2024-06-30\n2023-12-01\n';

beforeEach(() => {
	_resetMockState();
	_setConfig('dates-le.notificationLevel', 'all');
});

describe('filter command', () => {
	it('warns without an active editor', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		await runCommand('dates-le.filter');
		expect(events.some((e) => e.startsWith('warn:'))).toBe(true);
	});

	it('does nothing when the filter picker is dismissed', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		_respondToQuickPick(() => undefined);
		await runCommand('dates-le.filter');
		expect(events.some((e) => e.startsWith('info:'))).toBe(false);
	});

	it('applies a date-range filter', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		_respondToQuickPick(pickByIds(['dateRange']));
		// The range prompt asks for two dates in sequence.
		const answers = ['2024-01-01', '2024-12-31'];
		_respondToInputBox(() => answers.shift());
		await runCommand('dates-le.filter');
		expect(events.some((e) => e.startsWith('command-filter'))).toBe(true);
	});

	it('applies an include-formats filter', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		let call = 0;
		_respondToQuickPick((items) => {
			call += 1;
			// First pick chooses the filter kind; the second chooses formats.
			if (call === 1) return pickByIds(['includeFormats'])(items);
			return items.slice(0, 1);
		});
		await runCommand('dates-le.filter');
		expect(events.some((e) => e.startsWith('command-filter'))).toBe(true);
	});

	it('applies an exclude-formats filter', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		let call = 0;
		_respondToQuickPick((items) => {
			call += 1;
			if (call === 1) return pickByIds(['excludeFormats'])(items);
			return items.slice(0, 1);
		});
		await runCommand('dates-le.filter');
		expect(events.some((e) => e.startsWith('command-filter'))).toBe(true);
	});

	it('combines several filter kinds in one run', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		let call = 0;
		_respondToQuickPick((items) => {
			call += 1;
			if (call === 1) return pickByIds(['dateRange', 'includeFormats'])(items);
			return items.slice(0, 1);
		});
		const answers = ['2024-01-01', '2024-12-31'];
		_respondToInputBox(() => answers.shift());
		await runCommand('dates-le.filter');
		expect(events.some((e) => e.startsWith('command-filter'))).toBe(true);
	});

	it('applies the exclusion filters', async () => {
		// Each exclusion is its own switch arm and its own predicate in
		// applyFilters; none were reached because the earlier tests only picked
		// the range and format kinds.
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({
				content: '2024-01-15\n2024-01-15\n1850-03-04\n2999-12-31\nnot a date\n',
				languageId: 'log',
			}),
		);
		_respondToQuickPick(
			pickByIds([
				'excludeDuplicates',
				'excludeInvalid',
				'excludeFuture',
				'excludePast',
			]),
		);
		await runCommand('dates-le.filter');
		expect(events.some((e) => e.startsWith('command-filter'))).toBe(true);
	});

	it('applies a single exclusion on its own', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({
				content: '2024-01-15\n2024-01-15\n2023-06-30\n',
				languageId: 'log',
			}),
		);
		_respondToQuickPick(pickByIds(['excludeDuplicates']));
		await runCommand('dates-le.filter');
		expect(events.some((e) => e.startsWith('command-filter'))).toBe(true);
	});

	it('reports a document with no dates', async () => {
		const { events, deps } = makeDeps();
		registerFilterCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: 'nothing here', languageId: 'log' }),
		);
		await runCommand('dates-le.filter');
		expect(
			events.some((e) => e.startsWith('info:') || e.startsWith('warn:')),
		).toBe(true);
	});
});

describe('validate command', () => {
	it('warns without an active editor', async () => {
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		await runCommand('dates-le.validate');
		expect(events.some((e) => e.startsWith('warn:'))).toBe(true);
	});

	it('does nothing when the rule picker is dismissed', async () => {
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		_respondToQuickPick(() => undefined);
		await runCommand('dates-le.validate');
		expect(events.some((e) => e.startsWith('info:'))).toBe(false);
	});

	it('runs every rule when all are selected', async () => {
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		_respondToQuickPick((items) => items);
		await runCommand('dates-le.validate');
		expect(events.some((e) => e.startsWith('command-validate'))).toBe(true);
	});

	it('flags a future date', async () => {
		// Exercises the "Not Future Date" predicate specifically.
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: '2999-01-01\n', languageId: 'log' }),
		);
		_respondToQuickPick((items) => items);
		await runCommand('dates-le.validate');
		expect(events.some((e) => e.startsWith('command-validate'))).toBe(true);
	});

	it('flags a date outside the reasonable range', async () => {
		// Year < 1900 trips "Reasonable Date Range".
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: '1850-03-04\n', languageId: 'log' }),
		);
		_respondToQuickPick((items) => items);
		await runCommand('dates-le.validate');
		expect(events.some((e) => e.startsWith('command-validate'))).toBe(true);
	});

	it('handles a mix of compliant and non-compliant dates', async () => {
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({
				content: '2024-01-15T10:00:00Z\n1850-03-04\n2999-01-01\n',
				languageId: 'log',
			}),
		);
		_respondToQuickPick((items) => items);
		await runCommand('dates-le.validate');
		expect(events.some((e) => e.startsWith('command-validate'))).toBe(true);
	});

	it('runs a single selected rule', async () => {
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: DATES, languageId: 'log' }));
		_respondToQuickPick((items) => items.slice(0, 1));
		await runCommand('dates-le.validate');
		expect(events.some((e) => e.startsWith('command-validate'))).toBe(true);
	});

	it('reports a document with no dates', async () => {
		const { events, deps } = makeDeps();
		registerValidateCommand(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: 'nothing here', languageId: 'log' }),
		);
		await runCommand('dates-le.validate');
		expect(
			events.some((e) => e.startsWith('info:') || e.startsWith('warn:')),
		).toBe(true);
	});
});

describe('analyze report sections', () => {
	// The report is built section by section, each behind a "did we find any"
	// check — formats, years, anomalies, patterns. A document that produces
	// none of them leaves most of the file unexercised, which is what the
	// existing suite did.

	async function analyze(content: string) {
		const { events, deps } = makeDeps();
		registerAnalyzeCommand(makeContext(), deps);
		_setActiveEditor(_createDocument({ content, languageId: 'log' }));
		await runCommand('dates-le.analyze');
		return events;
	}

	it('includes a formats section for mixed formats', async () => {
		const events = await analyze(
			'2024-01-15\n01/15/2024\n2024-06-30T10:00:00Z\n15 Jan 2024\n',
		);
		expect(events.some((e) => e.startsWith('command-analyze-success'))).toBe(
			true,
		);
	});

	it('includes a years section for dates spanning years', async () => {
		const events = await analyze(
			'2021-03-01\n2022-04-02\n2023-05-03\n2024-06-04\n',
		);
		expect(events.some((e) => e.startsWith('command-analyze-success'))).toBe(
			true,
		);
	});

	it('reports anomalies for future and out-of-range dates', async () => {
		const events = await analyze('2999-01-01\n1850-03-04\n2024-01-15\n');
		expect(events.some((e) => e.startsWith('command-analyze-success'))).toBe(
			true,
		);
	});

	it('truncates a long anomaly list', async () => {
		// More than five anomalies of one type trips the "and N more" branch.
		const future = Array.from(
			{ length: 8 },
			(_, i) => `29${90 + i}-01-01`,
		).join('\n');
		const events = await analyze(`${future}\n2024-01-15\n`);
		expect(events.some((e) => e.startsWith('command-analyze-success'))).toBe(
			true,
		);
	});

	it('detects a regular interval pattern', async () => {
		// Evenly spaced dates are what the pattern detector looks for.
		const weekly = Array.from(
			{ length: 8 },
			(_, i) => `2024-01-${String(1 + i * 7).padStart(2, '0')}`,
		).join('\n');
		const events = await analyze(weekly);
		expect(events.some((e) => e.startsWith('command-analyze-success'))).toBe(
			true,
		);
	});

	it('handles a single date without a range or pattern', async () => {
		const events = await analyze('2024-01-15\n');
		expect(events.some((e) => e.startsWith('command-analyze'))).toBe(true);
	});
});
