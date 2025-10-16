<p align="center">
  <img src="src/assets/images/icon.png" alt="Dates-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Dates-LE: Zero Hassle Date Extraction</h1>
<p align="center">
  <b>Instantly extract dates from your codebase with precision</b><br/>
  <i>JSON, YAML, CSV, XML, Log files, HTML, JavaScript, TypeScript, and more</i>
</p>

<p align="center">
  <!-- VS Code Marketplace -->
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le">
    <img src="https://img.shields.io/visual-studio-marketplace/v/nolindnaidoo.dates-le" alt="VSCode Marketplace Version" />
  </a>
  <!-- Open VSX -->
  <a href="https://open-vsx.org/extension/nolindnaidoo/dates-le">
    <img src="https://img.shields.io/open-vsx/v/nolindnaidoo/dates-le" alt="Open VSX Version" />
  </a>
  <!-- Build -->
  <a href="https://github.com/nolindnaidoo/dates-le/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/nolindnaidoo/dates-le/ci.yml?branch=main" alt="Build Status" />
  </a>
  <!-- License -->
  <a href="https://github.com/nolindnaidoo/dates-le/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/nolindnaidoo/dates-le" alt="MIT License" />
  </a>
</p>

<p align="center">
  <i>Tested on <b>Ubuntu</b>, <b>macOS</b>, and <b>Windows</b> for maximum compatibility.</i>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Date Extraction Demo" style="max-width: 100%; height: auto;" />
</p>

<p align="center">
  <img src="src/assets/images/command-palette.png" alt="Command Palette" style="max-width: 80%; height: auto;" />
</p>

## 🙏 Thank You

If Dates-LE saves you time, a quick rating helps other developers discover it:  
⭐ [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le) • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/dates-le)

## ✅ Why Dates-LE?

Extract dates from **any file format** — JSON, YAML, CSV, logs, HTML, JavaScript — in one click. Find timestamps, creation dates, and temporal data instantly.

Dates-LE intelligently detects ISO, RFC2822, Unix timestamps, and custom date formats while providing comprehensive analysis and validation. Audit temporal data, validate date ranges, and track time-based patterns without manual searching.

- **Temporal data audit without the hassle**  
  Instantly extract and analyze dates from any project. Get comprehensive insights into timestamps, creation dates, and temporal patterns.

- **Analysis across logs & APIs**  
  Surface every date reference for validation, range checking, and temporal analysis verification.

- **Confident edits in complex projects**  
  Flatten nested dates into a simple list you can safely analyze without breaking structure or formatting.

- **Stream massive datasets**  
  Work with large numbers of dates without locking up VS Code. Process large log files and data exports efficiently.

- **Advanced analysis built-in**
  - **Analyze** for statistics, anomalies, and patterns
  - **Convert** between formats and timezones
  - **Filter** by ranges, formats, or conditions
  - **Validate** with configurable rules
- **Fast at any scale**  
  Benchmarked for high throughput across all formats:

  | Format     | Throughput           | Use Cases                 | File Sizes  | Tested On        |
  | ---------- | -------------------- | ------------------------- | ----------- | ---------------- |
  | JSON       | 37,977+ dates/sec    | APIs, large datasets      | 1KB - 5MB   | M1 Mac, Intel i7 |
  | CSV        | 24,649+ dates/sec    | Data analysis, exports    | 1KB - 10MB  | M1 Mac, Intel i7 |
  | LOG        | 680,000+ dates/sec   | Log analysis, monitoring  | 1KB - 5KB   | M1 Mac, Intel i7 |
  | YAML       | 139,510+ dates/sec   | Configuration files       | 1KB - 25KB  | M1 Mac, Intel i7 |
  | HTML       | 1,559,391+ dates/sec | Web content, metadata     | 1KB - 50KB  | M1 Mac, Intel i7 |
  | JavaScript | 1,442,254+ dates/sec | Code analysis, timestamps | 1KB - 100KB | M1 Mac, Intel i7 |

## 🚀 More from the LE Family

- **[String-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.string-le)** - Extract user-visible strings for i18n and validation • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/string-le)
- **[Numbers-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le)** - Extract and analyze numeric data with statistics • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/numbers-le)
- **[EnvSync-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.envsync-le)** - Keep .env files in sync with visual diffs • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/envsync-le)
- **[Paths-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le)** - Extract file paths from imports and dependencies • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/paths-le)
- **[Scrape-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.scrape-le)** - Validate scraper targets before debugging • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/scrape-le)
- **[Colors-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le)** - Extract and analyze colors from stylesheets • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/colors-le)
- **[URLs-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.urls-le)** - Extract URLs from any codebase with precision • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/urls-le)

## 💡 Use Cases

- **Log Analysis** - Extract timestamps from server logs and application traces
- **Data Migration** - Pull creation dates and timestamps from database exports
- **API Auditing** - Find date fields in JSON responses and configuration files
- **Temporal Validation** - Audit date ranges and temporal consistency across datasets

## 🚀 Quick Start

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le) or [Open VSX](https://open-vsx.org/extension/nolindnaidoo/dates-le)
2. Open any supported file type (`Cmd/Ctrl + P` → search for "Dates-LE")
3. Run Quick Extract (`Cmd+Shift+D` / `Ctrl+Shift+D` / Status Bar)

## ⚙️ Configuration

Dates-LE has minimal configuration to keep things simple. Most settings are available in VS Code's settings UI under "Dates-LE".

Key settings include:

- Output format preferences (side-by-side, clipboard copy)
- Safety warnings and thresholds for large files
- Analysis and validation options
- Notification levels (silent, important, all)
- Status bar visibility
- Local telemetry logging for debugging

For the complete list of available settings, open VS Code Settings and search for "dates-le".

## 🌍 Language Support

**13 languages**: English, German, Spanish, French, Indonesian, Italian, Japanese, Korean, Portuguese (Brazil), Russian, Ukrainian, Vietnamese, Chinese (Simplified)

## 🧩 System Requirements

**VS Code** 1.70.0+ • **Platform** Windows, macOS, Linux  
**Memory** 200MB recommended for large files

## 🔒 Privacy

100% local processing. No data leaves your machine. Optional logging: `dates-le.telemetryEnabled`

## ⚡ Performance

<!-- PERFORMANCE_START -->

Dates-LE is built for speed and efficiently processes files from 100KB to 10MB+. See [detailed benchmarks](docs/PERFORMANCE.md).

| Format   | File Size | Throughput | Duration | Memory | Tested On     |
| -------- | --------- | ---------- | -------- | ------ | ------------- |
| **JSON** | 1K lines  | 37,977     | ~24.29   | < 1MB  | Apple Silicon |
| **CSV**  | 5K lines  | 24,649     | ~454.39  | < 1MB  | Apple Silicon |
| **LOG**  | 51 lines  | 680,000    | ~0.15    | < 1MB  | Apple Silicon |

**Note**: Performance results are based on files containing actual dates. Files without dates are processed much faster but extract 0 dates.  
**Real-World Performance**: Tested with actual data up to 10MB (practical limit: 1MB warning, 5MB error threshold)  
**Performance Monitoring**: Built-in real-time tracking with configurable thresholds  
**Full Metrics**: [docs/PERFORMANCE.md](docs/PERFORMANCE.md) • Test Environment: macOS, Bun 1.2.22, Node 22.x

<!-- PERFORMANCE_END -->

## 🧪 Testing & Quality

- **Test Coverage**: 15.4% overall coverage with 39 passing tests
- **Format Coverage**: JSON, YAML, CSV extraction formats with 83.8% coverage
- **Performance Testing**: Comprehensive benchmarks across all supported formats
- **Quality Assurance**: TypeScript strict mode, Biome linting, and comprehensive error handling

## 🔧 Troubleshooting

**Not detecting dates?**  
Ensure file is saved with supported extension (.json, .yaml, .csv, .xml, .log, .html, .js, .ts)

**Large files slow?**  
Files over 5MB may take longer. Consider splitting into smaller chunks

**Need help?**  
Check [Issues](https://github.com/nolindnaidoo/dates-le/issues) or enable logging: `dates-le.telemetryEnabled: true`

## ❓ FAQ

**What date formats are extracted?**  
ISO 8601, RFC2822, Unix timestamps, UTC, local formats, and simple date patterns

**Can I analyze dates?**  
Yes, use the Analyze command for statistics, anomaly detection, and pattern recognition

**Max file size?**  
Up to 10MB. Practical limit: 5MB for optimal performance

**Perfect for log analysis?**  
Absolutely! Extract timestamps from server logs, application traces, and monitoring data

---

Copyright © 2025
<a href="https://github.com/nolindnaidoo">@nolindnaidoo</a>. All rights reserved.
