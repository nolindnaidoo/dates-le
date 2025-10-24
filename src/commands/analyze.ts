import * as vscode from 'vscode';
import {
	analyzeDates,
	type DateAnalysis,
	type DateAnomaly,
} from '../analysis/statistics';
import { extractDates } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Localizer } from '../utils/localization';
import { formatDuration } from '../utils/localization';
import type { PerformanceMonitor } from '../utils/performance';

export function registerAnalyzeCommand(
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
		'dates-le.analyze',
		async () => {
			deps.telemetry.event('command-analyze');

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
						title: 'Analyzing dates...',
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
							deps.notifier.showInfo('No dates found to analyze');
							return;
						}

						progress.report({
							increment: 50,
							message: 'Performing analysis...',
						});

						// Perform comprehensive analysis
						const analysis = analyzeDates(extractionResult.dates);

						if (token.isCancellationRequested) return;

						progress.report({
							increment: 100,
							message: 'Generating report...',
						});

						// Generate analysis report
						const report = generateAnalysisReport(analysis, deps.localizer);

						// Open results
						await openAnalysisResults(report, deps.notifier);

						deps.telemetry.event('command-analyze-success', {
							datesCount: extractionResult.dates.length,
							anomaliesCount: analysis.anomalies.length,
							patternsCount: analysis.patterns.length,
						});
					},
				);
			} catch (error) {
				deps.errorHandler.handle({
					category: 'operational',
					originalError:
						error instanceof Error ? error : new Error(String(error)),
					message: 'Failed to analyze dates',
					userFriendlyMessage:
						'Analysis failed. Please check the file format and try again.',
					suggestion: 'Ensure the file contains valid date formats',
					recoverable: true,
					timestamp: new Date(),
				});
			}
		},
	);

	context.subscriptions.push(command);
}

function generateAnalysisReport(
	analysis: DateAnalysis,
	_localizer: Localizer,
): string {
	const { statistics, anomalies, patterns, clusters, gaps } = analysis;

	const report = [
		'# Date Analysis Report',
		'',
		'## 📊 Statistics',
		'',
		`**Total Dates**: ${statistics.total}`,
		`**Unique Dates**: ${statistics.unique}`,
		`**Duplicates**: ${statistics.duplicates}`,
		'',
	];

	if (
		statistics.earliest &&
		statistics.latest &&
		statistics.range !== null &&
		statistics.average &&
		statistics.median
	) {
		report.push(
			`**Date Range**: ${statistics.earliest.toISOString()} to ${statistics.latest.toISOString()}`,
			`**Duration**: ${formatDuration(statistics.range)}`,
			`**Average Date**: ${statistics.average.toISOString()}`,
			`**Median Date**: ${statistics.median.toISOString()}`,
			'',
		);
	}

	// Format distribution
	if (Object.keys(statistics.formats).length > 0) {
		report.push('### 📝 Format Distribution');
		Object.entries(statistics.formats)
			.sort(([, a], [, b]) => b - a)
			.forEach(([format, count]) => {
				const percentage = ((count / statistics.total) * 100).toFixed(1);
				report.push(`- **${format.toUpperCase()}**: ${count} (${percentage}%)`);
			});
		report.push('');
	}

	// Year distribution
	if (Object.keys(statistics.years).length > 0) {
		report.push('### 📅 Year Distribution');
		Object.entries(statistics.years)
			.sort(([a], [b]) => parseInt(b, 10) - parseInt(a, 10))
			.forEach(([year, count]) => {
				const percentage = ((count / statistics.total) * 100).toFixed(1);
				report.push(`- **${year}**: ${count} (${percentage}%)`);
			});
		report.push('');
	}

	// Anomalies
	if (anomalies.length > 0) {
		report.push('## ⚠️ Anomalies Detected');
		report.push('');

		const groupedAnomalies = groupAnomaliesByType(anomalies);
		Object.entries(groupedAnomalies).forEach(([type, typeAnomalies]) => {
			report.push(`### ${getAnomalyTypeTitle(type)} (${typeAnomalies.length})`);
			typeAnomalies.slice(0, 5).forEach((anomaly) => {
				report.push(`- **${anomaly.date.value}**: ${anomaly.description}`);
				if (anomaly.suggestion) {
					report.push(`  - 💡 *${anomaly.suggestion}*`);
				}
			});
			if (typeAnomalies.length > 5) {
				report.push(`- ... and ${typeAnomalies.length - 5} more`);
			}
			report.push('');
		});
	}

	// Patterns
	if (patterns.length > 0) {
		report.push('## 🔍 Patterns Detected');
		report.push('');
		patterns.forEach((pattern) => {
			const confidence = (pattern.confidence * 100).toFixed(1);
			report.push(
				`### ${getPatternTypeTitle(pattern.type)} (${confidence}% confidence)`,
			);
			report.push(`- ${pattern.description}`);
			if (pattern.examples.length > 0) {
				report.push(`- **Examples**: ${pattern.examples.join(', ')}`);
			}
			report.push('');
		});
	}

	// Clusters
	if (clusters.length > 0) {
		report.push('## 📦 Date Clusters');
		report.push('');
		clusters
			.sort((a, b) => b.density - a.density)
			.slice(0, 5)
			.forEach((cluster, index) => {
				report.push(`### Cluster ${index + 1} (${cluster.dates.length} dates)`);
				report.push(`- **Center**: ${cluster.center.toISOString()}`);
				report.push(`- **Density**: ${cluster.density.toFixed(2)} dates/hour`);
				report.push(`- **Description**: ${cluster.description}`);
				report.push('');
			});
	}

	// Gaps
	if (gaps.length > 0) {
		report.push('## ⏳ Temporal Gaps');
		report.push('');
		gaps
			.sort((a, b) => b.duration - a.duration)
			.slice(0, 5)
			.forEach((gap, index) => {
				report.push(`### Gap ${index + 1}`);
				report.push(`- **Duration**: ${formatDuration(gap.duration)}`);
				report.push(`- **From**: ${gap.start.toISOString()}`);
				report.push(`- **To**: ${gap.end.toISOString()}`);
				report.push('');
			});
	}

	// Summary
	report.push('## 📋 Summary');
	report.push('');
	report.push(`- **Total dates analyzed**: ${statistics.total}`);
	report.push(`- **Unique dates**: ${statistics.unique}`);
	report.push(`- **Anomalies found**: ${anomalies.length}`);
	report.push(`- **Patterns detected**: ${patterns.length}`);
	report.push(`- **Clusters identified**: ${clusters.length}`);
	report.push(`- **Temporal gaps**: ${gaps.length}`);

	if (anomalies.length > 0) {
		const highSeverityAnomalies = anomalies.filter(
			(a) => a.severity === 'high',
		).length;
		if (highSeverityAnomalies > 0) {
			report.push(
				`- ⚠️ **High severity issues**: ${highSeverityAnomalies} (require attention)`,
			);
		}
	}

	return report.join('\n');
}

async function openAnalysisResults(
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

	notifier.showInfo('Date analysis complete. Results opened in new editor.');
}

function groupAnomaliesByType(
	anomalies: readonly DateAnomaly[],
): Record<string, DateAnomaly[]> {
	const grouped: Record<string, DateAnomaly[]> = {};
	anomalies.forEach((anomaly) => {
		if (!grouped[anomaly.type]) {
			grouped[anomaly.type] = [];
		}
		grouped[anomaly.type]!.push(anomaly);
	});
	return grouped;
}

function getAnomalyTypeTitle(type: string): string {
	const titles: Record<string, string> = {
		future: 'Future Dates',
		invalid: 'Invalid Dates',
		outlier: 'Outliers',
		duplicate: 'Duplicates',
		'format-inconsistent': 'Format Inconsistencies',
	};
	return titles[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function getPatternTypeTitle(type: string): string {
	const titles: Record<string, string> = {
		frequency: 'Frequency Pattern',
		interval: 'Interval Pattern',
		seasonal: 'Seasonal Pattern',
		trend: 'Trend Pattern',
	};
	return titles[type] || type.charAt(0).toUpperCase() + type.slice(1);
}
