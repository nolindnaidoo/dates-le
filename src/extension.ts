import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerOpenSettingsCommand } from './config/settings';
import { createTelemetry } from './telemetry/telemetry';
import { createNotifier } from './ui/notifier';
import { createStatusBar } from './ui/statusBar';
import { createErrorHandler } from './utils/errorHandling';
import { createLocalizer } from './utils/localization';
import { createPerformanceMonitor } from './utils/performance';

export function activate(context: vscode.ExtensionContext): void {
	// Create core services
	const telemetry = createTelemetry();
	const notifier = createNotifier();
	const statusBar = createStatusBar(context);
	const localizer = createLocalizer();
	const performanceMonitor = createPerformanceMonitor();

	// Register disposables to prevent memory leaks
	context.subscriptions.push(telemetry);
	context.subscriptions.push(statusBar);

	// Create error handling service
	const errorHandler = createErrorHandler({
		showParseErrors: true,
		notificationsLevel: 'all',
	});

	// Register all commands
	registerCommands(context, {
		telemetry,
		notifier,
		statusBar,
		localizer,
		performanceMonitor,
		errorHandler,
	});

	// Register settings command
	registerOpenSettingsCommand(context, telemetry);

	telemetry.event('extension-activated');
}

export function deactivate(): void {
	// Extensions are automatically disposed via context.subscriptions
}
