# Dates-LE Performance Test Results

**Test Environment:**
- Node.js: v24.3.0
- Platform: darwin arm64
- Date: 2025-10-16T21:39:31.004Z

## Summary

- **Total Files Tested:** 12
- **Total Extraction Time:** 208883.98ms
- **Average Extraction Time:** 17407ms
- **Fastest Format:** LOG
- **Slowest Format:** CSV

## Detailed Results

| Format | File | Size | Lines | Time (ms) | Extracted | Dates/sec | MB/sec | Memory (MB) |
|--------|------|------|-------|-----------|-----------|-----------|--------|-----------|
| JSON | 10kb.json | 0.01MB | 102 | 0.99 | 102 | 103,030 | 8.74 | 0 |
| CSV | 50kb.csv | 0.03MB | 513 | 6.2 | 512 | 82,581 | 5.11 | 0 |
| LOG | 5k.log | 0MB | 51 | 0.15 | 102 | 680,000 | 17.76 | 0 |
| JSON | 100kb.json | 0.09MB | 1,024 | 24.29 | 1,024 | 42,157 | 3.61 | 0 |
| CSV | 500kb.csv | 0.32MB | 5,121 | 454.39 | 5,120 | 11,268 | 0.71 | 0 |
| YAML | 25k.yaml | 0.02MB | 768 | 3.67 | 512 | 139,510 | 5.43 | 0 |
| JSON | 1mb.json | 0.91MB | 10,485 | 1857.25 | 10,485 | 5,645 | 0.49 | 9.91 |
| CSV | 2mb.csv | 1.33MB | 20,972 | 5165.07 | 20,971 | 4,060 | 0.26 | 15.429999999999998 |
| HTML | 50k.html | 0.04MB | 512 | 1.97 | 3,072 | 1,559,391 | 18.34 | 0 |
| JSON | 5mb.json | 4.59MB | 52,428 | 48726.73 | 52,428 | 1,076 | 0.09 | 29.550000000000004 |
| CSV | 10mb.csv | 6.69MB | 104,858 | 152641.14 | 104,857 | 687 | 0.04 | 53.71 |
| JAVASCRIPT | 100k.js | 0.05MB | 1,024 | 2.13 | 3,072 | 1,442,254 | 24.72 | 0 |

## Performance Analysis

**JSON:** Average 12652.32ms extraction time, 16,010 dates extracted on average.

**CSV:** Average 39566.7ms extraction time, 32,865 dates extracted on average.

**LOG:** Average 0.15ms extraction time, 102 dates extracted on average.

**YAML:** Average 3.67ms extraction time, 512 dates extracted on average.

**HTML:** Average 1.97ms extraction time, 3,072 dates extracted on average.

**JAVASCRIPT:** Average 2.13ms extraction time, 3,072 dates extracted on average.

