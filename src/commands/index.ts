import type * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerAnalyzeCommand } from './analyze';
import { registerConvertCommand } from './convert';
import { registerDedupeCommand } from './dedupe';
import { registerExtractCommand } from './extract';
import { registerFilterCommand } from './filter';
import { registerHelpCommand } from './help';
import { registerSortCommand } from './sort';
import { registerValidateCommand } from './validate';

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	registerExtractCommand(context, {
		telemetry: deps.telemetry,
		notifier: deps.notifier,
		statusBar: deps.statusBar,
	});
	registerDedupeCommand(context, deps.notifier);
	registerSortCommand(context, deps.notifier);
	registerAnalyzeCommand(context, deps);
	registerConvertCommand(context, deps);
	registerFilterCommand(context, deps);
	registerValidateCommand(context, deps);
	registerHelpCommand(context, deps);
}
