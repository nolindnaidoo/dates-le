import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getConfiguration } from '../config/config';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface StatusBar {
	showProgress(message: string): void;
	hideProgress(): void;
	dispose(): void;
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	const config = getConfiguration();
	let statusBarItem: vscode.StatusBarItem | undefined;

	if (config.statusBarEnabled) {
		statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100,
		);
		statusBarItem.text = localize('runtime.statusbar.text.default', 'Dates-LE');
		statusBarItem.tooltip = localize(
			'runtime.statusbar.tooltip.default',
			'Dates-LE: Date extraction and analysis',
		);
		statusBarItem.command = 'dates-le.extractDates';
		context.subscriptions.push(statusBarItem);
		statusBarItem.show();
	}

	return Object.freeze({
		showProgress(message: string): void {
			if (statusBarItem) {
				statusBarItem.text = `$(loading~spin) ${message}`;
			}
		},
		hideProgress(): void {
			if (statusBarItem) {
				statusBarItem.text = localize(
					'runtime.statusbar.text.default',
					'Dates-LE',
				);
			}
		},
		dispose(): void {
			statusBarItem?.dispose();
		},
	});
}
