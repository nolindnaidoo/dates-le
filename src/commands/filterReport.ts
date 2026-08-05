import * as vscode from 'vscode';
import type { DateValue } from '../types';
import type { Notifier } from '../ui/notifier';
import type { DateFilterOptions } from './filter';

/**
 * Rendering the filter report and opening it.
 *
 * Split from the command file, which held registration, the prompts, the run
 * and the report in one place.
 */

export function generateFilterReport(
	originalDates: readonly DateValue[],
	filteredDates: DateValue[],
	options: DateFilterOptions,
): string {
	const report = [
		'# Date Filter Report',
		'',
		`**Original Dates**: ${originalDates.length}`,
		`**Filtered Dates**: ${filteredDates.length}`,
		`**Removed**: ${originalDates.length - filteredDates.length}`,
		'',
	];

	// Show applied filters
	report.push('## Applied Filters');
	report.push('');

	if (options.dateRange) {
		report.push(
			`- **Date Range**: ${options.dateRange.start.toISOString()} to ${options.dateRange.end.toISOString()}`,
		);
	}
	if (options.formats) {
		report.push(`- **Include Formats**: ${options.formats.join(', ')}`);
	}
	if (options.excludeFormats) {
		report.push(`- **Exclude Formats**: ${options.excludeFormats.join(', ')}`);
	}
	if (options.excludeDuplicates) {
		report.push('- **Remove Duplicates**: Yes');
	}
	if (options.excludeInvalid) {
		report.push('- **Remove Invalid Dates**: Yes');
	}
	if (options.excludeFuture) {
		report.push('- **Remove Future Dates**: Yes');
	}
	if (options.excludePast) {
		report.push('- **Remove Past Dates**: Yes');
	}

	report.push('');

	// Show filtered results
	report.push('## Filtered Dates');
	report.push('');

	if (filteredDates.length === 0) {
		report.push('No dates match the applied filters.');
		return report.join('\n');
	}

	filteredDates.forEach((date, index) => {
		report.push(`${index + 1}. ${date.value} (${date.format.toUpperCase()})`);
	});

	return report.join('\n');
}

export async function openFilterResults(
	report: string,
	notifier: Notifier,
): Promise<void> {
	const doc = await vscode.workspace.openTextDocument({
		content: report,
		language: 'markdown',
	});

	await vscode.window.showTextDocument(doc, {
		viewColumn: vscode.ViewColumn.Beside,
		preserveFocus: true,
	});

	notifier.showInfo(
		vscode.l10n.t('Date filtering complete. Results opened in new editor.'),
	);
}
