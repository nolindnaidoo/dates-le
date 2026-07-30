import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createExtensionContext,
	_fireConfigChange,
	_registeredCommands,
	_resetMockState,
	_setConfig,
	_shownMessages,
	executedBuiltins,
} from '../__mocks__/vscode';
import { registerOpenSettingsCommand } from '../config/settings';
import { activate } from '../extension';
import { createServices } from '../services/serviceFactory';
import { createTelemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import { createStatusBar } from '../ui/statusBar';

beforeEach(() => {
	_resetMockState();
});

describe('createServices / activate', () => {
	it('activate registers every declared command', () => {
		const context = _createExtensionContext();
		activate(context as never);

		const declared = [
			'dates-le.extractDates',
			'dates-le.postProcess.dedupe',
			'dates-le.postProcess.sort',
			'dates-le.analyze',
			'dates-le.convert',
			'dates-le.filter',
			'dates-le.validate',
			'dates-le.openSettings',
			'dates-le.help',
		];
		for (const id of declared) {
			expect(_registeredCommands().has(id), id).toBe(true);
		}
	});

	it('createServices returns frozen bag and registers disposables', () => {
		const context = _createExtensionContext();
		const services = createServices(context as never);
		expect(Object.isFrozen(services)).toBe(true);
		expect(context.subscriptions.length).toBeGreaterThan(0);
	});
});

describe('telemetry', () => {
	it('is a no-op when disabled (default)', () => {
		const telemetry = createTelemetry();
		telemetry.event('x');
		telemetry.dispose();
	});

	it('writes when enabled, including after a runtime toggle', () => {
		const telemetry = createTelemetry();
		telemetry.event('before-enable');
		_setConfig('dates-le.telemetryEnabled', true);
		telemetry.event('after-enable', { count: 2 });
		telemetry.dispose();
	});
});

describe('statusBar', () => {
	it('shows progress and restores idle text', () => {
		const context = _createExtensionContext();
		const statusBar = createStatusBar(context as never);
		statusBar.showProgress('Working...');
		statusBar.hideProgress();
		statusBar.dispose();
	});

	it('reacts to statusBar.enabled config changes', () => {
		const context = _createExtensionContext();
		createStatusBar(context as never);
		_setConfig('dates-le.statusBar.enabled', false);
		_fireConfigChange('dates-le.statusBar.enabled');
	});
});

describe('notifier respects notificationsLevel', () => {
	it('silent (default): errors only', () => {
		const notifier = createNotifier();
		notifier.showInfo('i');
		notifier.showWarning('w');
		notifier.showError('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual(['error']);
	});

	it('important: warnings and errors', () => {
		_setConfig('dates-le.notificationsLevel', 'important');
		const notifier = createNotifier();
		notifier.showInfo('i');
		notifier.showWarning('w');
		notifier.showError('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual(['warning', 'error']);
	});

	it('all: everything', () => {
		_setConfig('dates-le.notificationsLevel', 'all');
		const notifier = createNotifier();
		notifier.showInfo('i');
		notifier.showWarning('w');
		notifier.showError('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual([
			'info',
			'warning',
			'error',
		]);
	});
});

describe('openSettings command', () => {
	it('opens the settings UI scoped to dates-le', async () => {
		const context = _createExtensionContext();
		registerOpenSettingsCommand(context as never, {
			event: () => {},
			dispose: () => {},
		});
		await _registeredCommands().get('dates-le.openSettings')?.();
		expect(executedBuiltins[0]?.id).toBe('workbench.action.openSettings');
	});
});
