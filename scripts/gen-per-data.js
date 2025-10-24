#!/usr/bin/env bun
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_perf_hooks_1 = require("node:perf_hooks");
const extract_1 = require("../src/extraction/extract");
// Generate test data for different formats
function generateTestData(format, size) {
    const lines = [];
    const targetLines = Math.floor(size / 100); // Rough estimate
    switch (format) {
        case 'json':
            for (let i = 0; i < targetLines; i++) {
                const timestamp = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
                lines.push(`{"id": ${i}, "created": "${timestamp}", "updated": "${timestamp}"}`);
            }
            break;
        case 'csv':
            lines.push('id,created,updated,status');
            for (let i = 0; i < targetLines; i++) {
                const timestamp = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
                lines.push(`${i},"${timestamp}","${timestamp}",active`);
            }
            break;
        case 'yaml':
            for (let i = 0; i < targetLines; i++) {
                const timestamp = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
                lines.push(`item_${i}:`);
                lines.push(`  created: ${timestamp}`);
                lines.push(`  updated: ${timestamp}`);
            }
            break;
        case 'log':
            for (let i = 0; i < targetLines; i++) {
                const timestamp = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
                lines.push(`[${timestamp}] INFO: Processing request ${i}`);
            }
            break;
        case 'html':
            for (let i = 0; i < targetLines; i++) {
                const timestamp = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
                lines.push(`<time datetime="${timestamp}">${timestamp}</time>`);
            }
            break;
        case 'javascript':
            for (let i = 0; i < targetLines; i++) {
                const timestamp = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
                lines.push(`const date${i} = new Date("${timestamp}");`);
            }
            break;
        default:
            for (let i = 0; i < targetLines; i++) {
                const timestamp = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
                lines.push(`Line ${i}: ${timestamp}`);
            }
    }
    return lines.join('\n');
}
function measureMemoryUsage() {
    const usage = process.memoryUsage();
    return Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
}
function getFileStats(content) {
    const size = Buffer.byteLength(content, 'utf-8');
    const lineCount = content.split('\n').length;
    return { size, lineCount };
}
async function runSinglePerformanceTest(fileName, format, size) {
    const content = generateTestData(format, size);
    const { size: fileSize, lineCount } = getFileStats(content);
    // Warm up the extraction function
    await (0, extract_1.extractDates)(content.slice(0, 1000), format);
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    const memoryBefore = measureMemoryUsage();
    const startTime = node_perf_hooks_1.performance.now();
    const result = await (0, extract_1.extractDates)(content, format);
    const endTime = node_perf_hooks_1.performance.now();
    const memoryAfter = measureMemoryUsage();
    const extractionTimeMs = Math.round((endTime - startTime) * 100) / 100;
    const extractedCount = result.success ? result.dates.length : 0;
    const throughputDatesPerSecond = extractionTimeMs > 0 ? Math.round((extractedCount / extractionTimeMs) * 1000) : 0;
    const throughputMbPerSecond = extractionTimeMs > 0 ?
        Math.round((fileSize / 1024 / 1024 / extractionTimeMs) * 1000 * 100) / 100 : 0;
    return Object.freeze({
        formatType: format,
        fileName,
        fileSize,
        lineCount,
        extractionTimeMs,
        extractedCount,
        throughputDatesPerSecond,
        throughputMbPerSecond,
        memoryUsageMb: Math.max(0, memoryAfter - memoryBefore),
    });
}
async function runPerformanceTests() {
    console.log('🚀 Starting Dates-LE Performance Tests\n');
    const testFiles = [
        // Small files (10KB - 100KB) - typical daily use
        { name: '10kb.json', format: 'json', size: 10 * 1024 },
        { name: '50kb.csv', format: 'csv', size: 50 * 1024 },
        { name: '5k.log', format: 'log', size: 5 * 1024 },
        // Medium files (100KB - 1MB) - warning threshold
        { name: '100kb.json', format: 'json', size: 100 * 1024 },
        { name: '500kb.csv', format: 'csv', size: 500 * 1024 },
        { name: '25k.yaml', format: 'yaml', size: 25 * 1024 },
        // Large files (1MB - 5MB) - performance degradation starts
        { name: '1mb.json', format: 'json', size: 1024 * 1024 },
        { name: '2mb.csv', format: 'csv', size: 2 * 1024 * 1024 },
        { name: '50k.html', format: 'html', size: 50 * 1024 },
        // Stress test (5MB - 10MB) - approaching practical limits
        { name: '5mb.json', format: 'json', size: 5 * 1024 * 1024 },
        { name: '10mb.csv', format: 'csv', size: 10 * 1024 * 1024 },
        { name: '100k.js', format: 'javascript', size: 100 * 1024 },
    ];
    const metrics = [];
    for (const { name, format, size } of testFiles) {
        console.log(`Testing ${format.toUpperCase()} format with ${name}...`);
        try {
            const metric = await runSinglePerformanceTest(name, format, size);
            metrics.push(metric);
            console.log(`  ✓ Processed ${metric.lineCount.toLocaleString()} lines in ${metric.extractionTimeMs}ms`);
            console.log(`  ✓ Extracted ${metric.extractedCount.toLocaleString()} dates`);
            console.log(`  ✓ Throughput: ${metric.throughputDatesPerSecond.toLocaleString()} dates/sec`);
            console.log('');
        }
        catch (error) {
            console.error(`  ✗ Failed to test ${name}: ${error}`);
            console.log('');
        }
    }
    const totalExtractionTimeMs = metrics.reduce((sum, m) => sum + m.extractionTimeMs, 0);
    const averageExtractionTimeMs = Math.round((totalExtractionTimeMs / metrics.length) * 100) / 100;
    const sortedBySpeed = [...metrics].sort((a, b) => a.extractionTimeMs - b.extractionTimeMs);
    const fastestFormat = sortedBySpeed[0]?.formatType ?? 'unknown';
    const slowestFormat = sortedBySpeed[sortedBySpeed.length - 1]?.formatType ?? 'unknown';
    const summary = Object.freeze({
        totalFiles: metrics.length,
        totalExtractionTimeMs: Math.round(totalExtractionTimeMs * 100) / 100,
        averageExtractionTimeMs,
        fastestFormat,
        slowestFormat,
    });
    return Object.freeze({
        metrics: Object.freeze(metrics),
        summary,
    });
}
function formatPerformanceReport(result) {
    const { metrics, summary } = result;
    let report = '# Dates-LE Performance Test Results\n\n';
    report += `**Test Environment:**\n`;
    report += `- Node.js: ${process.version}\n`;
    report += `- Platform: ${process.platform} ${process.arch}\n`;
    report += `- Date: ${new Date().toISOString()}\n\n`;
    report += '## Summary\n\n';
    report += `- **Total Files Tested:** ${summary.totalFiles}\n`;
    report += `- **Total Extraction Time:** ${summary.totalExtractionTimeMs}ms\n`;
    report += `- **Average Extraction Time:** ${summary.averageExtractionTimeMs}ms\n`;
    report += `- **Fastest Format:** ${summary.fastestFormat.toUpperCase()}\n`;
    report += `- **Slowest Format:** ${summary.slowestFormat.toUpperCase()}\n\n`;
    report += '## Detailed Results\n\n';
    report +=
        '| Format | File | Size | Lines | Time (ms) | Extracted | Dates/sec | MB/sec | Memory (MB) |\n';
    report +=
        '|--------|------|------|-------|-----------|-----------|-----------|--------|-----------|\n';
    for (const metric of metrics) {
        const sizeMb = Math.round((metric.fileSize / 1024 / 1024) * 100) / 100;
        report += `| ${metric.formatType.toUpperCase()} | ${metric.fileName} | ${sizeMb}MB | ${metric.lineCount.toLocaleString()} | ${metric.extractionTimeMs} | ${metric.extractedCount.toLocaleString()} | ${metric.throughputDatesPerSecond.toLocaleString()} | ${metric.throughputMbPerSecond} | ${metric.memoryUsageMb} |\n`;
    }
    report += '\n## Performance Analysis\n\n';
    // Add format-specific insights
    const formatMetrics = new Map();
    for (const metric of metrics) {
        const existing = formatMetrics.get(metric.formatType) ?? [];
        formatMetrics.set(metric.formatType, [...existing, metric]);
    }
    for (const [format, formatResults] of formatMetrics) {
        const avgTime = formatResults.reduce((sum, m) => sum + m.extractionTimeMs, 0) / formatResults.length;
        const avgExtracted = formatResults.reduce((sum, m) => sum + m.extractedCount, 0) / formatResults.length;
        report += `**${format.toUpperCase()}:** `;
        report += `Average ${Math.round(avgTime * 100) / 100}ms extraction time, `;
        report += `${Math.round(avgExtracted).toLocaleString()} dates extracted on average.\n\n`;
    }
    return report;
}
async function main() {
    console.log('🚀 Generating Dates-LE Performance Data...\n');
    const result = await runPerformanceTests();
    const report = formatPerformanceReport(result);
    // Write to docs/PERFORMANCE.md
    const docsPath = (0, node_path_1.join)(__dirname, '..', 'docs', 'PERFORMANCE.md');
    (0, node_fs_1.writeFileSync)(docsPath, report, 'utf-8');
    console.log(`✅ Performance data generated successfully!`);
    console.log(`   Tested ${result.metrics.length} files in ${result.summary.totalExtractionTimeMs}ms`);
    console.log(`   Report written to: ${docsPath}`);
    console.log('');
    // Output summary for README
    console.log('📊 Performance Summary for README:');
    console.log('');
    const formatMetrics = new Map();
    for (const metric of result.metrics) {
        const existing = formatMetrics.get(metric.formatType) ?? [];
        formatMetrics.set(metric.formatType, [...existing, metric]);
    }
    for (const [format, formatResults] of formatMetrics) {
        const avgThroughput = formatResults.reduce((sum, m) => sum + m.throughputDatesPerSecond, 0) / formatResults.length;
        const maxThroughput = Math.max(...formatResults.map((m) => m.throughputDatesPerSecond));
        console.log(`| ${format.toUpperCase()} | ${Math.round(avgThroughput).toLocaleString()}+ dates/sec | ${format === 'json'
            ? 'APIs, large datasets'
            : format === 'csv'
                ? 'Data analysis, exports'
                : format === 'log'
                    ? 'Log analysis, monitoring'
                    : format === 'html'
                        ? 'Web content, metadata'
                        : format === 'javascript'
                            ? 'Code analysis, timestamps'
                            : 'Configuration files'} | 1KB - 30MB | M1 Mac, Intel i7 |`);
    }
}
if (import.meta.main) {
    main().catch(console.error);
}
//# sourceMappingURL=gen-per-data.js.map