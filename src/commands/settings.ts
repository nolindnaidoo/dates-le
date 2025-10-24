import * as path from 'node:path';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getConfiguration } from '../config/config';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export function registerSettingsCommands(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	registerExportSettingsCommand(context, deps);
	registerImportSettingsCommand(context, deps);
	registerResetSettingsCommand(context, deps);
}

function registerExportSettingsCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.settings.export',
		async () => {
			deps.telemetry.event('command-settings-export');

			try {
				deps.statusBar.showProgress(
					localize('runtime.progress.exporting', 'Exporting settings...'),
				);

				const config = getConfiguration();
				const settingsData = {
					version: '1.0.0',
					exportedAt: new Date().toISOString(),
					settings: {
						copyToClipboardEnabled: config.copyToClipboardEnabled,
						dedupeEnabled: config.dedupeEnabled,
						notificationsLevel: config.notificationsLevel,
						openResultsSideBySide: config.openResultsSideBySide,
						safetyEnabled: config.safetyEnabled,
						safetyFileSizeWarnBytes: config.safetyFileSizeWarnBytes,
						safetyLargeOutputLinesThreshold:
							config.safetyLargeOutputLinesThreshold,
						safetyManyDocumentsThreshold: config.safetyManyDocumentsThreshold,
						showParseErrors: config.showParseErrors,
						statusBarEnabled: config.statusBarEnabled,
						telemetryEnabled: config.telemetryEnabled,
					},
				};

				// Show save dialog
				const uri = await vscode.window.showSaveDialog({
					filters: {
						'JSON Files': ['json'],
						'All Files': ['*'],
					},
					defaultUri: vscode.Uri.file('dates-le-settings.json'),
				});

				if (!uri) {
					deps.notifier.showInfo(
						localize(
							'runtime.settings.export.cancelled',
							'Settings export cancelled',
						),
					);
					return;
				}

				// Write settings to file
				await vscode.workspace.fs.writeFile(
					uri,
					Buffer.from(JSON.stringify(settingsData, null, 2), 'utf8'),
				);

				deps.notifier.showInfo(
					localize(
						'runtime.settings.export.success',
						'Settings exported successfully to {0}',
						path.basename(uri.fsPath),
					),
				);
				deps.telemetry.event('settings-export-success', { path: uri.fsPath });
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: localize(
								'runtime.error.unknown-fallback',
								'Unknown error occurred',
							);
				deps.notifier.showError(
					localize(
						'runtime.settings.export.error',
						'Failed to export settings: {0}',
						message,
					),
				);
				deps.telemetry.event('settings-export-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}

function registerImportSettingsCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.settings.import',
		async () => {
			deps.telemetry.event('command-settings-import');

			try {
				deps.statusBar.showProgress(
					localize('runtime.progress.importing', 'Importing settings...'),
				);

				// Show open dialog
				const uri = await vscode.window.showOpenDialog({
					filters: {
						'JSON Files': ['json'],
						'All Files': ['*'],
					},
					canSelectMany: false,
				});

				if (!uri || uri.length === 0) {
					deps.notifier.showInfo(
						localize(
							'runtime.settings.import.cancelled',
							'Settings import cancelled',
						),
					);
					return;
				}

				// Read settings file
				const selectedUri = uri[0];
				if (!selectedUri) {
					deps.notifier.showInfo(
						localize(
							'runtime.settings.import.cancelled',
							'Settings import cancelled',
						),
					);
					return;
				}

				const fileContent = await vscode.workspace.fs.readFile(selectedUri);
				const settingsData = JSON.parse(
					Buffer.from(fileContent).toString('utf8'),
				);

				// Validate settings data
				if (
					!settingsData.settings ||
					typeof settingsData.settings !== 'object'
				) {
					throw new Error(
						localize(
							'runtime.settings.import.invalid',
							'Invalid settings file format',
						),
					);
				}

				// Confirm import
				const confirm = await vscode.window.showWarningMessage(
					localize(
						'runtime.settings.import.confirm',
						'This will overwrite your current Dates-LE settings. Continue?',
					),
					{ modal: true },
					localize('runtime.confirmation.continue', 'Continue'),
					localize('runtime.confirmation.cancel', 'Cancel'),
				);

				if (confirm !== localize('runtime.confirmation.continue', 'Continue')) {
					deps.notifier.showInfo(
						localize(
							'runtime.settings.import.cancelled',
							'Settings import cancelled',
						),
					);
					return;
				}

				// Apply settings
				const config = vscode.workspace.getConfiguration('dates-le');
				const settings = settingsData.settings;

				// Update each setting
				const updates: Array<[string, unknown]> = [
					['copyToClipboardEnabled', settings.copyToClipboardEnabled],
					['dedupeEnabled', settings.dedupeEnabled],
					['notificationsLevel', settings.notificationsLevel],
					['openResultsSideBySide', settings.openResultsSideBySide],
					['safety.enabled', settings.safetyEnabled],
					['safety.fileSizeWarnBytes', settings.safetyFileSizeWarnBytes],
					[
						'safety.largeOutputLinesThreshold',
						settings.safetyLargeOutputLinesThreshold,
					],
					[
						'safety.manyDocumentsThreshold',
						settings.safetyManyDocumentsThreshold,
					],
					['showParseErrors', settings.showParseErrors],
					['statusBar.enabled', settings.statusBarEnabled],
					['telemetryEnabled', settings.telemetryEnabled],
				];

				for (const [key, value] of updates) {
					if (value !== undefined) {
						await config.update(key, value, vscode.ConfigurationTarget.Global);
					}
				}

				deps.notifier.showInfo(
					localize(
						'runtime.settings.import.success',
						'Settings imported successfully from {0}',
						path.basename(selectedUri.fsPath),
					),
				);
				deps.telemetry.event('settings-import-success', {
					path: selectedUri.fsPath,
				});
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: localize(
								'runtime.error.unknown-fallback',
								'Unknown error occurred',
							);
				deps.notifier.showError(
					localize(
						'runtime.settings.import.error',
						'Failed to import settings: {0}',
						message,
					),
				);
				deps.telemetry.event('settings-import-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}

function registerResetSettingsCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.settings.reset',
		async () => {
			deps.telemetry.event('command-settings-reset');

			try {
				// Confirm reset
				const confirm = await vscode.window.showWarningMessage(
					localize(
						'runtime.settings.reset.confirm',
						'This will reset all Dates-LE settings to their default values. This action cannot be undone. Continue?',
					),
					{ modal: true },
					localize('runtime.confirmation.continue', 'Continue'),
					localize('runtime.confirmation.cancel', 'Cancel'),
				);

				if (confirm !== localize('runtime.confirmation.continue', 'Continue')) {
					deps.notifier.showInfo(
						localize(
							'runtime.settings.reset.cancelled',
							'Settings reset cancelled',
						),
					);
					return;
				}

				deps.statusBar.showProgress(
					localize('runtime.progress.resetting', 'Resetting settings...'),
				);

				// Get default configuration
				const config = vscode.workspace.getConfiguration('dates-le');
				const defaultConfig = getDefaultConfiguration();

				// Reset each setting to default
				const resets: Array<[string, unknown]> = [
					['copyToClipboardEnabled', defaultConfig.copyToClipboardEnabled],
					['dedupeEnabled', defaultConfig.dedupeEnabled],
					['notificationsLevel', defaultConfig.notificationsLevel],
					['openResultsSideBySide', defaultConfig.openResultsSideBySide],
					['safety.enabled', defaultConfig.safetyEnabled],
					['safety.fileSizeWarnBytes', defaultConfig.safetyFileSizeWarnBytes],
					[
						'safety.largeOutputLinesThreshold',
						defaultConfig.safetyLargeOutputLinesThreshold,
					],
					[
						'safety.manyDocumentsThreshold',
						defaultConfig.safetyManyDocumentsThreshold,
					],
					['showParseErrors', defaultConfig.showParseErrors],
					['statusBar.enabled', defaultConfig.statusBarEnabled],
					['telemetryEnabled', defaultConfig.telemetryEnabled],
				];

				for (const [key, value] of resets) {
					await config.update(key, value, vscode.ConfigurationTarget.Global);
				}

				deps.notifier.showInfo(
					localize(
						'runtime.settings.reset.success',
						'Settings reset to default values',
					),
				);
				deps.telemetry.event('settings-reset-success');
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: localize(
								'runtime.error.unknown-fallback',
								'Unknown error occurred',
							);
				deps.notifier.showError(
					localize(
						'runtime.settings.reset.error',
						'Failed to reset settings: {0}',
						message,
					),
				);
				deps.telemetry.event('settings-reset-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}

function getDefaultConfiguration() {
	return Object.freeze({
		copyToClipboardEnabled: false,
		dedupeEnabled: false,
		notificationsLevel: 'silent' as const,
		openResultsSideBySide: false,
		safetyEnabled: true,
		safetyFileSizeWarnBytes: 1000000,
		safetyLargeOutputLinesThreshold: 50000,
		safetyManyDocumentsThreshold: 8,
		showParseErrors: false,
		statusBarEnabled: true,
		telemetryEnabled: false,
	});
}
