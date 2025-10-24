# Dates-LE Performance Test Results

**Test Environment:**

- Node.js: v24.3.0
- Platform: darwin arm64
- Date: 2025-10-16T22:20:09.789Z

## Summary

- **Total Files Tested:** 12
- **Total Extraction Time:** 274635.64ms
- **Average Extraction Time:** 22886.3ms
- **Fastest Format:** LOG
- **Slowest Format:** CSV

## Detailed Results

| Format     | File       | Size   | Lines   | Time (ms) | Extracted | Dates/sec | MB/sec | Memory (MB)        |
| ---------- | ---------- | ------ | ------- | --------- | --------- | --------- | ------ | ------------------ |
| JSON       | 10kb.json  | 0.01MB | 102     | 0.96      | 102       | 106,250   | 9.01   | 0                  |
| CSV        | 50kb.csv   | 0.03MB | 513     | 7.68      | 512       | 66,667    | 4.12   | 0                  |
| LOG        | 5k.log     | 0MB    | 51      | 0.15      | 102       | 680,000   | 17.76  | 0                  |
| JSON       | 100kb.json | 0.09MB | 1,024   | 27.26     | 1,024     | 37,564    | 3.22   | 0                  |
| CSV        | 500kb.csv  | 0.32MB | 5,121   | 546.26    | 5,120     | 9,373     | 0.59   | 0                  |
| YAML       | 25k.yaml   | 0.02MB | 768     | 3.28      | 512       | 156,098   | 6.07   | 0                  |
| JSON       | 1mb.json   | 0.91MB | 10,485  | 2194.63   | 10,485    | 4,778     | 0.41   | 9.91               |
| CSV        | 2mb.csv    | 1.33MB | 20,972  | 5084.16   | 20,971    | 4,125     | 0.26   | 15.429999999999998 |
| HTML       | 50k.html   | 0.04MB | 512     | 1.84      | 3,072     | 1,669,565 | 19.64  | 0                  |
| JSON       | 5mb.json   | 4.59MB | 52,428  | 50324.23  | 52,428    | 1,042     | 0.09   | 32.6               |
| CSV        | 10mb.csv   | 6.69MB | 104,858 | 216441.2  | 104,857   | 484       | 0.03   | 46.24              |
| JAVASCRIPT | 100k.js    | 0.05MB | 1,024   | 3.99      | 3,072     | 769,925   | 13.2   | 0                  |

## Performance Analysis

**JSON:** Average 13136.77ms extraction time, 16,010 dates extracted on average.

**CSV:** Average 55519.83ms extraction time, 32,865 dates extracted on average.

**LOG:** Average 0.15ms extraction time, 102 dates extracted on average.

**YAML:** Average 3.28ms extraction time, 512 dates extracted on average.

**HTML:** Average 1.84ms extraction time, 3,072 dates extracted on average.

**JAVASCRIPT:** Average 3.99ms extraction time, 3,072 dates extracted on average.

**Note**: These are actual benchmark results from test files. Real-world performance will vary based on file content, system resources, and VS Code environment. The high throughput numbers (1.67M, 770K dates/sec) represent optimal conditions with dense date content.
