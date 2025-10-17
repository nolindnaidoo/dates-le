import { bench } from 'vitest';
import { extractDates } from '../extraction/extract';

// Test data generators
function generateLogContent(size: number): string {
	const dates = [
		'2023-12-25T10:30:00Z',
		'Mon, 25 Dec 2023 10:30:00 GMT',
		'1703506200',
		'12/25/2023 10:30:00',
		'2023-12-25',
	];
	const entries = [];

	for (let i = 0; i < size; i++) {
		const date = dates[i % dates.length];
		entries.push(`${date} - Log entry ${i}: User performed action`);
	}

	return entries.join('\n');
}

function generateJavaScriptContent(size: number): string {
	const dates = [
		'2023-12-25T10:30:00Z',
		'Mon, 25 Dec 2023 10:30:00 GMT',
		'1703506200',
		'12/25/2023 10:30:00',
		'2023-12-25',
	];
	const variables = [];

	for (let i = 0; i < size; i++) {
		const date = dates[i % dates.length];
		variables.push(`const date${i} = "${date}";`);
	}

	return variables.join('\n');
}

// Benchmark tests
bench('extractDates: Log - 1KB', async () => {
	const content = generateLogContent(50);
	await extractDates(content, 'log', { enablePerformanceMonitoring: true });
});

bench('extractDates: Log - 10KB', async () => {
	const content = generateLogContent(500);
	await extractDates(content, 'log', { enablePerformanceMonitoring: true });
});

bench('extractDates: Log - 100KB', async () => {
	const content = generateLogContent(5000);
	await extractDates(content, 'log', { enablePerformanceMonitoring: true });
});

bench('extractDates: Log - 1MB', async () => {
	const content = generateLogContent(50000);
	await extractDates(content, 'log', { enablePerformanceMonitoring: true });
});

bench('extractDates: JavaScript - 1KB', async () => {
	const content = generateJavaScriptContent(50);
	await extractDates(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});
});

bench('extractDates: JavaScript - 10KB', async () => {
	const content = generateJavaScriptContent(500);
	await extractDates(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});
});

bench('extractDates: JavaScript - 100KB', async () => {
	const content = generateJavaScriptContent(5000);
	await extractDates(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});
});

bench('extractDates: JavaScript - 1MB', async () => {
	const content = generateJavaScriptContent(50000);
	await extractDates(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});
});

// Memory usage tests
bench('extractDates: Memory usage - Large Log', async () => {
	const content = generateLogContent(10000);
	const result = await extractDates(content, 'log', {
		enablePerformanceMonitoring: true,
	});

	// Log memory usage if available
	if (process?.memoryUsage) {
		console.log('Memory usage:', process.memoryUsage());
	}

	return result;
});

bench('extractDates: Memory usage - Large JavaScript', async () => {
	const content = generateJavaScriptContent(10000);
	const result = await extractDates(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});

	// Log memory usage if available
	if (process?.memoryUsage) {
		console.log('Memory usage:', process.memoryUsage());
	}

	return result;
});
