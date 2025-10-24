import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';

export function registerHelpCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand('dates-le.help', async () => {
		deps.telemetry.event('command-help');

		const helpText = `
# Dates-LE Help & Troubleshooting

## Commands
- **Extract Dates** (Ctrl+Alt+D / Cmd+Alt+D): Extract dates from the current document
- **Open Settings**: Configure Dates-LE settings
- **Export Settings**: Export your configuration to a JSON file
- **Import Settings**: Import configuration from a JSON file
- **Reset Settings**: Reset all settings to defaults

## Supported Formats
Dates-LE works with structured data formats for reliable extraction:
- **JSON** (.json)
- **YAML** (.yaml, .yml)
- **CSV** (.csv)

## Date Formats Detected
- ISO 8601: 2023-12-25T10:30:00.000Z, 2023-12-25
- RFC 2822: Mon, 25 Dec 2023 10:30:00 GMT
- Unix timestamp: 1703508600 (seconds since epoch)
- UTC string: Mon Dec 25 2023 10:30:00 GMT+0000
- Local string: Mon Dec 25 2023 10:30:00 GMT-0500
- Custom formats: 12/25/2023, 25-Dec-2023, etc.

## Features

### Date Extraction
- Detects dates in various formats
- Extracts from JSON properties, YAML values, CSV columns
- Outputs dates in their original format
- Optional deduplication of repeated dates

### Post-Processing
- **Deduplication**: Remove duplicate dates (enable via settings)
- **Clipboard**: Automatically copy results (enable via settings)
- **Side-by-side**: View results alongside source file

## Troubleshooting

### No dates found
- Ensure the file is JSON, YAML, or CSV format
- Check that the file contains valid date patterns
- Verify the file is saved with the correct extension
- Try reloading the VS Code window

### Performance issues
- Large files may take time to process
- Enable safety warnings to get alerts for files over 1MB
- Consider breaking very large files into smaller chunks

### Extension not working
- Check VS Code version (requires 1.105.0+)
- Check Output panel → "Dates-LE" for error messages
- Try disabling other date-related extensions

## Settings
Access settings via Command Palette: "Dates-LE: Open Settings"

Key settings:
- Copy to clipboard: Automatically copy extraction results
- Deduplication: Remove duplicate dates from results
- Side-by-side view: Open results in split editor
- Safety checks: Warn before processing large files
- Notification level: Control message verbosity
- Status bar: Show/hide status bar indicator
- Telemetry: Enable local-only logging

## Support
- GitHub Issues: https://github.com/OffensiveEdge/dates-le/issues
- Documentation: https://github.com/OffensiveEdge/dates-le#readme
		`.trim();

		const doc = await vscode.workspace.openTextDocument({
			content: helpText,
			language: 'markdown',
		});
		await vscode.window.showTextDocument(doc, {
			preview: false,
			viewColumn: vscode.ViewColumn.Beside,
		});
	});

	context.subscriptions.push(command);
}
