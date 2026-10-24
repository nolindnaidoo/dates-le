import * as vscode from 'vscode';
import { guarded } from '../commands/guard';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';

export function registerOpenSettingsCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.openSettings',
		guarded(createNotifier(), async () => {
			telemetry.event('command-open-settings');
			await vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'dates-le',
			);
		}),
	);

	context.subscriptions.push(command);
}
