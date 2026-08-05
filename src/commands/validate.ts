import * as vscode from 'vscode';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { DateValue } from '../types';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { sanitizeErrorMessage } from '../utils/errors';
import {
	generateValidationReport,
	openValidationResults,
} from './validateReport';

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
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'dates-le.validate',
		async () => {
			deps.telemetry.event('command-validate');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning(vscode.l10n.t('No active editor found'));
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
						title: vscode.l10n.t('Validating dates...'),
						cancellable: true,
					},
					async (progress, token) => {
						progress.report({
							increment: 0,
							message: vscode.l10n.t('Extracting dates...'),
						});

						// Extract dates first
						const extractionResult = await extractDates(content, languageId);

						if (token.isCancellationRequested) return;

						if (
							!extractionResult.success ||
							extractionResult.dates.length === 0
						) {
							deps.notifier.showInfo(
								vscode.l10n.t('No dates found to validate'),
							);
							return;
						}

						progress.report({
							increment: 30,
							message: vscode.l10n.t('Selecting validation rules...'),
						});

						// Let user select validation rules
						const validationRules = await selectValidationRules();

						if (token.isCancellationRequested || !validationRules) return;

						progress.report({
							increment: 50,
							message: vscode.l10n.t('Running validation...'),
						});

						// Run validation
						const validationResults = validateDates(
							extractionResult.dates,
							validationRules,
						);

						if (token.isCancellationRequested) return;

						progress.report({
							increment: 80,
							message: vscode.l10n.t('Generating report...'),
						});

						// Generate validation report
						const report = generateValidationReport(
							validationResults,
							validationRules,
						);

						progress.report({
							increment: 100,
							message: vscode.l10n.t('Opening results...'),
						});

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
				const message = error instanceof Error ? error.message : String(error);
				deps.notifier.showError(
					`Failed to validate dates: ${sanitizeErrorMessage(message)}`,
				);
			}
		},
	);

	context.subscriptions.push(command);
}

async function selectValidationRules(): Promise<DateValidationRule[] | null> {
	const availableRules: DateValidationRule[] = [
		{
			name: 'Valid Date Format',
			description: vscode.l10n.t(
				'Ensure dates are in valid format and can be parsed',
			),
			validate: (date) => {
				if (!date.timestamp) return false;
				return !Number.isNaN(new Date(date.timestamp).getTime());
			},
			severity: 'error',
			suggestion: 'Check date format and ensure it matches expected pattern',
		},
		{
			name: 'Not Future Date',
			description: vscode.l10n.t('Ensure dates are not in the future'),
			validate: (date) => {
				if (!date.timestamp) return false;
				return new Date(date.timestamp) <= new Date();
			},
			severity: 'warning',
			suggestion: 'Verify if future dates are expected or correct the date',
		},
		{
			name: 'Reasonable Date Range',
			description: vscode.l10n.t(
				'Ensure dates are within reasonable range (1900-2100)',
			),
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
			description: vscode.l10n.t('Ensure dates follow ISO 8601 standard'),
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
			description: vscode.l10n.t('Ensure timezone information is consistent'),
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
			detail: vscode.l10n.t('Severity: {0}', rule.severity),
			rule,
		})),
		{
			placeHolder: vscode.l10n.t('Select validation rules to apply'),
			title: vscode.l10n.t('Date Validation - Select Rules'),
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
