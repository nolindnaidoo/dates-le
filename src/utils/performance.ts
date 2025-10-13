import * as vscode from 'vscode';
import type { UrlsLeError } from '../types';

export interface PerformanceMetrics {
	readonly duration: number;
	readonly memoryUsage: number;
	readonly cpuUsage: number;
	readonly throughput: number;
	readonly startTime: number;
	readonly endTime: number;
}

export interface PerformanceThresholds {
	readonly maxDuration: number;
	readonly maxMemoryUsage: number;
	readonly maxCpuUsage: number;
	readonly minThroughput: number;
}

export interface PerformanceTimer {
	readonly start: () => void;
	readonly end: () => PerformanceMetrics;
	readonly isRunning: boolean;
}

export interface PerformanceMonitor {
	readonly startTimer: (name: string) => PerformanceTimer;
	readonly endTimer: (timer: PerformanceTimer) => PerformanceMetrics;
	readonly checkThresholds: (
		metrics: PerformanceMetrics,
	) => PerformanceCheckResult;
	readonly createCache: <K, V>(maxSize?: number) => PerformanceCache<K, V>;
	readonly withProgress: <T>(
		title: string,
		operation: () => Promise<T>,
	) => Promise<T>;
	readonly withTimeout: <T>(
		operation: () => Promise<T>,
		timeoutMs: number,
	) => Promise<T>;
	readonly withCancellation: <T>(
		operation: (token: vscode.CancellationToken) => Promise<T>,
	) => Promise<T>;
	readonly withPerformanceMonitoring: <T>(
		operation: () => Promise<T>,
		thresholds?: PerformanceThresholds,
	) => Promise<{
		result: T;
		metrics: PerformanceMetrics;
		check: PerformanceCheckResult;
	}>;
}

export interface PerformanceCheckResult {
	readonly passed: boolean;
	readonly warnings: readonly PerformanceWarning[];
	readonly errors: readonly UrlsLeError[];
}

export interface PerformanceWarning {
	readonly type: 'duration' | 'memory' | 'cpu' | 'throughput';
	readonly message: string;
	readonly value: number;
	readonly threshold: number;
}

export interface ProgressReporter {
	readonly report: (message: string) => void;
	readonly reportIncrement: (increment: number, message?: string) => void;
	readonly reportComplete: (message: string) => void;
}

export interface PerformanceCache<K, V> {
	readonly get: (key: K) => V | undefined;
	readonly set: (key: K, value: V) => void;
	readonly has: (key: K) => boolean;
	readonly delete: (key: K) => boolean;
	readonly clear: () => void;
	readonly size: number;
	readonly maxSize: number;
}

export function createPerformanceMonitor(): PerformanceMonitor {
	const timers = new Map<string, PerformanceTimer>();

	return Object.freeze({
		startTimer(name: string): PerformanceTimer {
			const timer = createTimer();
			timers.set(name, timer);

			// Clean up old timers to prevent memory leaks
			if (timers.size > 50) {
				const oldestKey = timers.keys().next().value;
				if (oldestKey) {
					timers.delete(oldestKey);
				}
			}

			return timer;
		},

		endTimer(timer: PerformanceTimer): PerformanceMetrics {
			const metrics = timer.end();

			// Clean up completed timers
			for (const [key, value] of timers.entries()) {
				if (value === timer) {
					timers.delete(key);
					break;
				}
			}

			return metrics;
		},

		checkThresholds(metrics: PerformanceMetrics): PerformanceCheckResult {
			const warnings: PerformanceWarning[] = [];
			const errors: UrlsLeError[] = [];

			// Check duration threshold
			if (metrics.duration > 5000) {
				// 5 seconds default
				warnings.push({
					type: 'duration',
					message: `Operation took ${formatDuration(metrics.duration)}, exceeding threshold`,
					value: metrics.duration,
					threshold: 5000,
				});
			}

			// Check memory threshold
			if (metrics.memoryUsage > 104857600) {
				// 100MB default
				warnings.push({
					type: 'memory',
					message: `Memory usage ${formatBytes(metrics.memoryUsage)}, exceeding threshold`,
					value: metrics.memoryUsage,
					threshold: 104857600,
				});
			}

			// Check CPU threshold
			if (metrics.cpuUsage > 1000000) {
				// 1 second default
				warnings.push({
					type: 'cpu',
					message: `CPU usage ${formatDuration(metrics.cpuUsage)}, exceeding threshold`,
					value: metrics.cpuUsage,
					threshold: 1000000,
				});
			}

			// Check throughput threshold
			if (metrics.throughput < 1000) {
				// 1000 dates/second default
				warnings.push({
					type: 'throughput',
					message: `Throughput ${formatThroughput(metrics.throughput)}, below threshold`,
					value: metrics.throughput,
					threshold: 1000,
				});
			}

			return Object.freeze({
				passed: warnings.length === 0,
				warnings: Object.freeze(warnings),
				errors: Object.freeze(errors),
			});
		},

		createCache<K, V>(maxSize: number = 1000): PerformanceCache<K, V> {
			return createPerformanceCache(maxSize);
		},

		async withProgress<T>(
			title: string,
			operation: () => Promise<T>,
		): Promise<T> {
			return new Promise((resolve, reject) => {
				vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title,
						cancellable: true,
					},
					async (_progress, token) => {
						try {
							token.onCancellationRequested(() => {
								reject(new Error('Operation cancelled'));
							});

							const result = await operation();
							resolve(result);
						} catch (error) {
							reject(error);
						}
					},
				);
			});
		},

		async withTimeout<T>(
			operation: () => Promise<T>,
			timeoutMs: number,
		): Promise<T> {
			return Promise.race([
				operation(),
				new Promise<never>((_, reject) => {
					setTimeout(() => {
						reject(new Error(`Operation timed out after ${timeoutMs}ms`));
					}, timeoutMs);
				}),
			]);
		},

		async withCancellation<T>(
			operation: (token: vscode.CancellationToken) => Promise<T>,
		): Promise<T> {
			const tokenSource = new vscode.CancellationTokenSource();

			try {
				return await operation(tokenSource.token);
			} finally {
				tokenSource.dispose();
			}
		},

		async withPerformanceMonitoring<T>(
			operation: () => Promise<T>,
			_thresholds?: PerformanceThresholds,
		): Promise<{
			result: T;
			metrics: PerformanceMetrics;
			check: PerformanceCheckResult;
		}> {
			const timer = createTimer();
			timer.start();

			try {
				const result = await operation();
				const metrics = timer.end();
				const check = this.checkThresholds(metrics);

				return { result, metrics, check };
			} catch (error) {
				const metrics = timer.end();
				// Check thresholds even on error for performance monitoring
				this.checkThresholds(metrics);

				// Error is re-thrown and should be handled by caller
				throw error;
			}
		},
	});
}

export function createPerformanceCache<K, V>(
	maxSize: number = 1000,
): PerformanceCache<K, V> {
	const cache = new Map<K, V>();
	const accessOrder = new Map<K, number>();
	let accessCounter = 0;

	return Object.freeze({
		get(key: K): V | undefined {
			const value = cache.get(key);
			if (value !== undefined) {
				accessOrder.set(key, ++accessCounter);
			}
			return value;
		},

		set(key: K, value: V): void {
			if (cache.size >= maxSize) {
				// Remove least recently used entry
				let oldestKey: K | undefined;
				let oldestAccess = Infinity;

				for (const [k, access] of accessOrder.entries()) {
					if (access < oldestAccess) {
						oldestAccess = access;
						oldestKey = k;
					}
				}

				if (oldestKey !== undefined) {
					cache.delete(oldestKey);
					accessOrder.delete(oldestKey);
				}
			}

			cache.set(key, value);
			accessOrder.set(key, ++accessCounter);
		},

		has(key: K): boolean {
			return cache.has(key);
		},

		delete(key: K): boolean {
			const deleted = cache.delete(key);
			if (deleted) {
				accessOrder.delete(key);
			}
			return deleted;
		},

		clear(): void {
			cache.clear();
			accessOrder.clear();
			accessCounter = 0;
		},

		get size(): number {
			return cache.size;
		},

		get maxSize(): number {
			return maxSize;
		},
	});
}

export async function withProgress<T>(
	title: string,
	operation: (
		progress: vscode.Progress<{ message?: string; increment?: number }>,
	) => Promise<T>,
): Promise<T> {
	return new Promise((resolve, reject) => {
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title,
				cancellable: true,
			},
			async (progress, token) => {
				try {
					token.onCancellationRequested(() => {
						reject(new Error('Operation cancelled'));
					});

					const result = await operation(progress);
					resolve(result);
				} catch (error) {
					reject(error);
				}
			},
		);
	});
}

export async function withTimeout<T>(
	operation: () => Promise<T>,
	timeoutMs: number,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`Operation timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		operation()
			.then((result) => {
				clearTimeout(timeout);
				resolve(result);
			})
			.catch((error) => {
				clearTimeout(timeout);
				reject(error);
			});
	});
}

export async function withCancellation<T>(
	operation: (token: vscode.CancellationToken) => Promise<T>,
): Promise<T> {
	const tokenSource = new vscode.CancellationTokenSource();

	try {
		return await operation(tokenSource.token);
	} finally {
		tokenSource.dispose();
	}
}

export async function withPerformanceMonitoring<T>(
	operation: () => Promise<T>,
	_thresholds?: PerformanceThresholds,
): Promise<{
	result: T;
	metrics: PerformanceMetrics;
	check: PerformanceCheckResult;
}> {
	const timer = createTimer();
	timer.start();

	try {
		const result = await operation();
		const metrics = timer.end();
		const check = createPerformanceMonitor().checkThresholds(metrics);

		return { result, metrics, check };
	} catch (error) {
		const metrics = timer.end();
		// Check thresholds even on error for performance monitoring
		createPerformanceMonitor().checkThresholds(metrics);

		// Error is re-thrown and should be handled by caller
		throw error;
	}
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(milliseconds: number): string {
	if (milliseconds < 1000) {
		return `${milliseconds}ms`;
	}

	const seconds = milliseconds / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(2)}s`;
	}

	const minutes = seconds / 60;
	if (minutes < 60) {
		return `${minutes.toFixed(2)}m`;
	}

	const hours = minutes / 60;
	return `${hours.toFixed(2)}h`;
}

export function formatThroughput(throughput: number): string {
	if (throughput < 1000) {
		return `${throughput.toFixed(0)} items/s`;
	}

	const k = throughput / 1000;
	if (k < 1000) {
		return `${k.toFixed(1)}K items/s`;
	}

	const m = k / 1000;
	return `${m.toFixed(1)}M items/s`;
}

export function getCpuUsage(): number | undefined {
	try {
		const usage = process.cpuUsage();
		return usage.user + usage.system;
	} catch {
		return undefined;
	}
}

export function createDefaultThresholds(): PerformanceThresholds {
	return Object.freeze({
		maxDuration: 5000, // 5 seconds
		maxMemoryUsage: 104857600, // 100MB
		maxCpuUsage: 1000000, // 1 second
		minThroughput: 1000, // 1000 items/second
	});
}

export function createPerformanceReport(metrics: PerformanceMetrics): string {
	return `
Performance Report
==================

Duration: ${formatDuration(metrics.duration)}
Memory Usage: ${formatBytes(metrics.memoryUsage)}
CPU Usage: ${formatDuration(metrics.cpuUsage)}
Throughput: ${formatThroughput(metrics.throughput)}

Start Time: ${new Date(metrics.startTime).toISOString()}
End Time: ${new Date(metrics.endTime).toISOString()}
`.trim();
}

export function generatePerformanceReport(
	metrics: PerformanceMetrics[],
): string {
	if (metrics.length === 0) {
		return 'No performance data available.';
	}

	const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
	const totalMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0);
	const totalCpu = metrics.reduce((sum, m) => sum + m.cpuUsage, 0);
	const avgThroughput =
		metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;

	return `
Performance Summary Report
==========================

Total Operations: ${metrics.length}
Total Duration: ${formatDuration(totalDuration)}
Total Memory Usage: ${formatBytes(totalMemory)}
Total CPU Usage: ${formatDuration(totalCpu)}
Average Throughput: ${formatThroughput(avgThroughput)}

Individual Reports:
${metrics.map((m, i) => `\n${i + 1}. ${createPerformanceReport(m)}`).join('')}
`.trim();
}

function createTimer(): PerformanceTimer {
	let startTime: number | undefined;
	let endTime: number | undefined;

	return Object.freeze({
		start(): void {
			startTime = Date.now();
		},

		end(): PerformanceMetrics {
			endTime = Date.now();
			const duration = endTime - (startTime ?? endTime);
			const memoryUsage = process.memoryUsage().heapUsed;
			const cpuUsage = getCpuUsage() ?? 0;
			const throughput = duration > 0 ? 1000 / duration : 0; // items per second

			return Object.freeze({
				duration,
				memoryUsage,
				cpuUsage,
				throughput,
				startTime: startTime ?? endTime,
				endTime: endTime,
			});
		},

		get isRunning(): boolean {
			return startTime !== undefined && endTime === undefined;
		},
	});
}
