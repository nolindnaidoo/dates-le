import type * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Localizer } from '../utils/localization';
import type { PerformanceMonitor } from '../utils/performance';
import { registerAnalyzeCommand } from './analyze';
import { registerConvertCommand } from './convert';
import { registerDedupeCommand } from './dedupe';
import { registerExtractCommand } from './extract';
import { registerFilterCommand } from './filter';
import { registerHelpCommand } from './help';
import { registerSettingsCommands } from './settings';
import { registerSortCommand } from './sort';
import { registerToggleCsvStreamingCommand } from './toggleCsvStreaming';
import { registerValidateCommand } from './validate';

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
		localizer: Localizer;
		performanceMonitor: PerformanceMonitor;
		errorHandler: ErrorHandler;
	}>,
): void {
	registerExtractCommand(context, {
		telemetry: deps.telemetry,
		notifier: deps.notifier,
		statusBar: deps.statusBar,
		performanceMonitor: deps.performanceMonitor,
	});
	registerDedupeCommand(context);
	registerSortCommand(context);
	registerAnalyzeCommand(context, deps);
	registerConvertCommand(context, deps);
	registerFilterCommand(context, deps);
	registerValidateCommand(context, deps);
	registerHelpCommand(context, deps);
	registerSettingsCommands(context, deps);
	registerToggleCsvStreamingCommand(context, deps.telemetry);
}
