import * as vscode from 'vscode';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { DateValue } from '../types';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Localizer } from '../utils/localization';
import type { PerformanceMonitor } from '../utils/performance';

export interface DateValidationRule {
	readonly name: string;
	readonly description: string;
	readonly validate: (date: DateValue) => boolean;
	readonly severity: 'error' | 'warning' | 'info';
	readonly suggestion?: string;
}

export interface DateValidationResult {
	readonly date: DateValue;
	readonly passed: boolean;
	readonly failures: Array<{
		readonly rule: string;
		readonly severity: 'error' | 'warning' | 'info';
		readonly message: string;
		readonly suggestion: string | undefined;
	}>;
}

export function registerValidateCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
		localizer: Localizer;
		performanceMonitor: PerformanceMonitor;
		errorHandler: ErrorHandler;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.validate',
		async () => {
			deps.telemetry.event('command-validate');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning('No active editor found');
				return;
			}

			const document = editor.document;
			const content = document.getText();
			const languageId = document.languageId;

			try {
				// Show progress
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Validating dates...',
						cancellable: true,
					},
					async (progress, token) => {
						progress.report({ increment: 0, message: 'Extracting dates...' });

						// Extract dates first
						const extractionResult = await extractDates(content, languageId);

						if (token.isCancellationRequested) return;

						if (
							!extractionResult.success ||
							extractionResult.dates.length === 0
						) {
							deps.notifier.showInfo('No dates found to validate');
							return;
						}

						progress.report({
							increment: 30,
							message: 'Selecting validation rules...',
						});

						// Let user select validation rules
						const validationRules = await selectValidationRules();

						if (token.isCancellationRequested || !validationRules) return;

						progress.report({
							increment: 50,
							message: 'Running validation...',
						});

						// Run validation
						const validationResults = validateDates(
							extractionResult.dates,
							validationRules,
						);

						if (token.isCancellationRequested) return;

						progress.report({ increment: 80, message: 'Generating report...' });

						// Generate validation report
						const report = generateValidationReport(
							validationResults,
							validationRules,
						);

						progress.report({ increment: 100, message: 'Opening results...' });

						// Open results
						await openValidationResults(report, deps.notifier);

						deps.telemetry.event('command-validate-success', {
							datesCount: extractionResult.dates.length,
							rulesCount: validationRules.length,
							passedCount: validationResults.filter((r) => r.passed).length,
							failedCount: validationResults.filter((r) => !r.passed).length,
						});
					},
				);
			} catch (error) {
				deps.errorHandler.handle({
					category: 'operational',
					originalError:
						error instanceof Error ? error : new Error(String(error)),
					message: 'Failed to validate dates',
					userFriendlyMessage:
						'Date validation failed. Please check the file format and try again.',
					suggestion: 'Ensure the file contains valid date formats',
					recoverable: true,
					timestamp: new Date(),
				});
			}
		},
	);

	context.subscriptions.push(command);
}

async function selectValidationRules(): Promise<DateValidationRule[] | null> {
	const availableRules: DateValidationRule[] = [
		{
			name: 'Valid Date Format',
			description: 'Ensure dates are in valid format and can be parsed',
			validate: (date) => {
				if (!date.timestamp) return false;
				return !Number.isNaN(new Date(date.timestamp).getTime());
			},
			severity: 'error',
			suggestion: 'Check date format and ensure it matches expected pattern',
		},
		{
			name: 'Not Future Date',
			description: 'Ensure dates are not in the future',
			validate: (date) => {
				if (!date.timestamp) return false;
				return new Date(date.timestamp) <= new Date();
			},
			severity: 'warning',
			suggestion: 'Verify if future dates are expected or correct the date',
		},
		{
			name: 'Reasonable Date Range',
			description: 'Ensure dates are within reasonable range (1900-2100)',
			validate: (date) => {
				if (!date.timestamp) return false;
				const year = new Date(date.timestamp).getFullYear();
				return year >= 1900 && year <= 2100;
			},
			severity: 'warning',
			suggestion: 'Check if the date is correct or represents a special case',
		},
		{
			name: 'ISO 8601 Compliance',
			description: 'Ensure dates follow ISO 8601 standard',
			validate: (date) => {
				if (date.format !== 'iso') return true; // Only validate ISO format
				return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
					date.value,
				);
			},
			severity: 'info',
			suggestion: 'Consider using ISO 8601 format for better compatibility',
		},
		{
			name: 'Timezone Consistency',
			description: 'Ensure timezone information is consistent',
			validate: (date) => {
				if (date.format !== 'iso') return true; // Only validate ISO format
				return (
					date.value.includes('Z') ||
					date.value.includes('+') ||
					date.value.includes('-')
				);
			},
			severity: 'info',
			suggestion: 'Include timezone information for better clarity',
		},
	];

	const selectedRules = await vscode.window.showQuickPick(
		availableRules.map((rule) => ({
			label: rule.name,
			description: rule.description,
			detail: `Severity: ${rule.severity}`,
			rule,
		})),
		{
			placeHolder: 'Select validation rules to apply',
			title: 'Date Validation - Select Rules',
			canPickMany: true,
		},
	);

	return selectedRules ? selectedRules.map((s) => s.rule) : null;
}

function validateDates(
	dates: readonly DateValue[],
	rules: DateValidationRule[],
): DateValidationResult[] {
	const results: DateValidationResult[] = [];

	for (const date of dates) {
		const failures: DateValidationResult['failures'] = [];

		for (const rule of rules) {
			if (!rule.validate(date)) {
				failures.push({
					rule: rule.name,
					severity: rule.severity,
					message: `${rule.name}: ${rule.description}`,
					suggestion: rule.suggestion,
				});
			}
		}

		results.push({
			date,
			passed: failures.length === 0,
			failures,
		});
	}

	return results;
}

function generateValidationReport(
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

async function openValidationResults(
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

	notifier.showInfo('Date validation complete. Results opened in new editor.');
}
