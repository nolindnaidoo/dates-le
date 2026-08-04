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
- **Analyze Dates**: Statistics, patterns, clusters, and anomalies for extracted dates
- **Convert Dates**: Convert dates in the document to another format
- **Filter Dates**: Extract dates matching a range or condition
- **Validate Dates**: Check date values in the document
- **Deduplicate Dates**: Remove duplicate lines from an extraction result
- **Sort Dates**: Sort extraction results chronologically or alphabetically
- **Open Settings**: Configure Dates-LE settings
- **Help**: Open this document

## Supported File Types
- **JSON** (.json)
- **YAML** (.yaml, .yml)
- **CSV** (.csv)
- **XML** (.xml)
- **Log / plain text** (.log, .txt)
- **JavaScript / TypeScript** (.js, .ts)
- **HTML** (.html)

## Date Formats Detected
- ISO 8601: 2023-12-25T10:30:00.000Z, 2023-12-25
- RFC 2822: Mon, 25 Dec 2023 10:30:00 GMT
- Unix timestamp: 1703508600 (seconds or milliseconds since epoch)
- UTC string: Mon Dec 25 2023 10:30:00 GMT+0000
- Local string: 12/25/2023 10:30:00

## Troubleshooting

### No dates found
- Ensure the file type is one of the supported formats above
- Check that the file contains recognizable date patterns
- Verify the editor language mode matches the file content

### Performance issues
- Large files may take time to process
- Safety warnings alert before processing files over the configured size

### Extension not working
- Check Output panel → "Dates-LE" for error messages

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
- GitHub Issues: https://github.com/nolindnaidoo/dates-le/issues
- Documentation: https://github.com/nolindnaidoo/dates-le#readme
- LE Tools: https://letools.dev

Enjoying it? A rating helps more than you'd think:
- Rate on VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le&ssr=false#review-details
- Rate on Open VSX: https://open-vsx.org/extension/nolindnaidoo/dates-le/reviews

Built by nolindnaidoo (https://github.com/nolindnaidoo) — MIT licensed.
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
