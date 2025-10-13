import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';

export function registerOpenSettingsCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.openSettings',
		async () => {
			telemetry.event('command-open-settings');
			await vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'dates-le',
			);
		},
	);

	context.subscriptions.push(command);
}
