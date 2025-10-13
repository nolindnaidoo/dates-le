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
- **Convert Date Formats**: Convert dates to different formats
- **Analyze Dates**: Generate a detailed analysis report
- **Open Settings**: Configure Dates-LE settings

## Supported Formats
- Log files, JavaScript, TypeScript
- JSON, YAML, CSV
- Configuration files and documentation

## Date Formats Supported
- ISO 8601: 2023-12-25T10:30:00.000Z
- RFC 2822: Mon, 25 Dec 2023 10:30:00 GMT
- Unix timestamp: 1703508600
- UTC string: Mon Dec 25 2023 10:30:00 GMT+0000
- Local string: Mon Dec 25 2023 10:30:00 GMT-0500
- Custom formats: 2023-12-25, 12/25/2023, etc.

## Features

### Date Extraction
- Detects dates in various formats
- Supports multiple timezones
- Handles relative dates and timestamps
- Identifies date patterns in text

### Date Conversion
- Convert between different date formats
- Timezone conversion
- Locale-specific formatting
- Custom format support

### Date Analysis
- Pattern recognition
- Range analysis
- Anomaly detection
- Timezone analysis
- Frequency distribution

### Anomaly Detection
- Future dates
- Past dates
- Invalid dates
- Duplicate dates
- Outliers and suspicious patterns

## Troubleshooting

### No dates found
- Ensure the file contains valid date patterns
- Check that the file type is supported
- Verify date format is recognized

### Conversion failures
- Check date format compatibility
- Verify timezone settings
- Ensure valid date values

### Analysis issues
- Large files may take time to process
- Use safety settings to limit processing
- Consider breaking large files into smaller chunks

## Settings
Access settings via Command Palette: "Dates-LE: Open Settings"

Key settings:
- Output format (ISO, RFC2822, Unix, etc.)
- Default timezone
- Analysis options
- Safety thresholds

## Support
- GitHub Issues: https://github.com/nolindnaidoo/dates-le/issues
- Documentation: https://github.com/nolindnaidoo/dates-le#readme
		`.trim();

		const doc = await vscode.workspace.openTextDocument({
			content: helpText,
			language: 'markdown',
		});
		await vscode.window.showTextDocument(doc);
	});

	context.subscriptions.push(command);
}
