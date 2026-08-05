import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';
import type { DateValidationResult, DateValidationRule } from './validate';

/**
 * Rendering the validation report and opening it.
 *
 * Split from the command file, which held registration, the prompts, the run
 * and the report in one place.
 */

export function generateValidationReport(
	results: DateValidationResult[],
	rules: DateValidationRule[],
): string {
	const totalDates = results.length;
	const passedDates = results.filter((r) => r.passed).length;
	const failedDates = totalDates - passedDates;

	const report = [
		'# Date Validation Report',
		'',
		`**Total Dates**: ${totalDates}`,
		`**Passed Validation**: ${passedDates}`,
		`**Failed Validation**: ${failedDates}`,
		`**Success Rate**: ${totalDates > 0 ? ((passedDates / totalDates) * 100).toFixed(1) : 0}%`,
		'',
	];

	// Show validation rules
	report.push('## Validation Rules Applied');
	report.push('');
	rules.forEach((rule) => {
		const severityIcon =
			rule.severity === 'error'
				? '❌'
				: rule.severity === 'warning'
					? '⚠️'
					: 'ℹ️';
		report.push(`${severityIcon} **${rule.name}**: ${rule.description}`);
	});
	report.push('');

	// Show failed validations
	const failedResults = results.filter((r) => !r.passed);
	if (failedResults.length > 0) {
		report.push('## ❌ Failed Validations');
		report.push('');

		// Group by severity
		const errorFailures = failedResults.filter((r) =>
			r.failures.some((f) => f.severity === 'error'),
		);
		const warningFailures = failedResults.filter((r) =>
			r.failures.some((f) => f.severity === 'warning'),
		);
		const infoFailures = failedResults.filter((r) =>
			r.failures.some((f) => f.severity === 'info'),
		);

		if (errorFailures.length > 0) {
			report.push('### 🚨 Errors');
			report.push('');
			errorFailures.forEach((result, index) => {
				report.push(`#### ${index + 1}. ${result.date.value}`);
				result.failures
					.filter((f) => f.severity === 'error')
					.forEach((failure) => {
						report.push(`- **${failure.rule}**: ${failure.message}`);
						if (failure.suggestion) {
							report.push(`  - 💡 *${failure.suggestion}*`);
						}
					});
				report.push('');
			});
		}

		if (warningFailures.length > 0) {
			report.push('### ⚠️ Warnings');
			report.push('');
			warningFailures.forEach((result, index) => {
				report.push(`#### ${index + 1}. ${result.date.value}`);
				result.failures
					.filter((f) => f.severity === 'warning')
					.forEach((failure) => {
						report.push(`- **${failure.rule}**: ${failure.message}`);
						if (failure.suggestion) {
							report.push(`  - 💡 *${failure.suggestion}*`);
						}
					});
				report.push('');
			});
		}

		if (infoFailures.length > 0) {
			report.push('### ℹ️ Information');
			report.push('');
			infoFailures.forEach((result, index) => {
				report.push(`#### ${index + 1}. ${result.date.value}`);
				result.failures
					.filter((f) => f.severity === 'info')
					.forEach((failure) => {
						report.push(`- **${failure.rule}**: ${failure.message}`);
						if (failure.suggestion) {
							report.push(`  - 💡 *${failure.suggestion}*`);
						}
					});
				report.push('');
			});
		}
	}

	// Show passed validations
	const passedResults = results.filter((r) => r.passed);
	if (passedResults.length > 0) {
		report.push('## ✅ Passed Validations');
		report.push('');
		report.push(
			`All ${passedResults.length} dates passed validation successfully.`,
		);
		report.push('');
	}

	// Summary
	report.push('## 📋 Summary');
	report.push('');
	report.push(`- **Total dates validated**: ${totalDates}`);
	report.push(`- **Validation rules applied**: ${rules.length}`);
	report.push(`- **Successfully validated**: ${passedDates}`);
	report.push(`- **Validation failures**: ${failedDates}`);

	if (failedDates > 0) {
		const errorCount = results.filter((r) =>
			r.failures.some((f) => f.severity === 'error'),
		).length;
		const warningCount = results.filter((r) =>
			r.failures.some((f) => f.severity === 'warning'),
		).length;

		if (errorCount > 0) {
			report.push(
				`- 🚨 **Critical issues**: ${errorCount} (require immediate attention)`,
			);
		}
		if (warningCount > 0) {
			report.push(`- ⚠️ **Warnings**: ${warningCount} (should be reviewed)`);
		}
	}

	return report.join('\n');
}

export async function openValidationResults(
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
		vscode.l10n.t('Date validation complete. Results opened in new editor.'),
	);
}
