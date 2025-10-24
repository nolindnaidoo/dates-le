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
  <a href="https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.dates-le">
    <img src="https://img.shields.io/visual-studio-marketplace/v/OffensiveEdge.dates-le" alt="VSCode Marketplace Version" />
  </a>
  <!-- Open VSX -->
  <a href="https://open-vsx.org/extension/OffensiveEdge/dates-le">
    <img src="https://img.shields.io/open-vsx/v/OffensiveEdge/dates-le" alt="Open VSX Version" />
  </a>
  <!-- Build -->
  <a href="https://github.com/OffensiveEdge/dates-le/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/OffensiveEdge/dates-le/ci.yml?branch=main" alt="Build Status" />
  </a>
  <!-- License -->
  <a href="https://github.com/OffensiveEdge/dates-le/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/OffensiveEdge/dates-le" alt="MIT License" />
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
⭐ [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.dates-le) • [Open VSX](https://open-vsx.org/extension/OffensiveEdge/dates-le)

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

  | Format     | Throughput        | Use Cases                 | File Sizes  | Tested On     |
  | ---------- | ----------------- | ------------------------- | ----------- | ------------- |
  | JSON       | 37,977 dates/sec  | APIs, large datasets      | 1KB - 5MB   | Apple Silicon |
  | CSV        | 24,649 dates/sec  | Data analysis, exports    | 1KB - 10MB  | Apple Silicon |
  | LOG        | 680,000 dates/sec | Log analysis, monitoring  | 1KB - 5KB   | Apple Silicon |
  | YAML       | 139,510 dates/sec | Configuration files       | 1KB - 25KB  | Apple Silicon |
  | HTML       | 1.56M dates/sec   | Web content, metadata     | 1KB - 50KB  | Apple Silicon |
  | JavaScript | 1.44M dates/sec   | Code analysis, timestamps | 1KB - 100KB | Apple Silicon |

## 🚀 More from the LE Family

- **[String-LE](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.string-le)** - Extract user-visible strings for i18n and validation • [Open VSX](https://open-vsx.org/extension/OffensiveEdge/string-le)
- **[Numbers-LE](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.numbers-le)** - Extract and analyze numeric data with statistics • [Open VSX](https://open-vsx.org/extension/OffensiveEdge/numbers-le)
- **[EnvSync-LE](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.envsync-le)** - Keep .env files in sync with visual diffs • [Open VSX](https://open-vsx.org/extension/OffensiveEdge/envsync-le)
- **[Paths-LE](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.paths-le)** - Extract file paths from imports and dependencies • [Open VSX](https://open-vsx.org/extension/OffensiveEdge/paths-le)
- **[Scrape-LE](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.scrape-le)** - Validate scraper targets before debugging • [Open VSX](https://open-vsx.org/extension/OffensiveEdge/scrape-le)
- **[Colors-LE](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.colors-le)** - Extract and analyze colors from stylesheets • [Open VSX](https://open-vsx.org/extension/OffensiveEdge/colors-le)
- **[URLs-LE](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.urls-le)** - Extract URLs from any codebase with precision • [Open VSX](https://open-vsx.org/extension/OffensiveEdge/urls-le)

## 💡 Use Cases

- **Log Analysis** - Extract timestamps from server logs and application traces
- **Data Migration** - Pull creation dates and timestamps from database exports
- **API Auditing** - Find date fields in JSON responses and configuration files
- **Temporal Validation** - Audit date ranges and temporal consistency across datasets

## 🚀 Quick Start

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.dates-le) or [Open VSX](https://open-vsx.org/extension/OffensiveEdge/dates-le)
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

🇺🇸 **English** • 🇩🇪 **German** • 🇪🇸 **Spanish** • 🇫🇷 **French** • 🇮🇩 **Indonesian** • 🇮🇹 **Italian** • 🇯🇵 **Japanese** • 🇰🇷 **Korean** • 🇧🇷 **Portuguese (Brazil)** • 🇷🇺 **Russian** • 🇺🇦 **Ukrainian** • 🇻🇳 **Vietnamese** • 🇨🇳 **Chinese (Simplified)**

## 🧩 System Requirements

**VS Code** 1.70.0+ • **Platform** Windows, macOS, Linux  
**Memory** 200MB recommended for large files

## 🔒 Privacy

100% local processing. No data leaves your machine. Optional logging: `dates-le.telemetryEnabled`

## ⚡ Performance

<!-- PERFORMANCE_START -->

Dates-LE is built for speed and efficiently processes files from 100KB to 10MB+. See [detailed benchmarks](docs/PERFORMANCE.md).

| Format         | File Size | Throughput | Duration | Memory | Tested On     |
| -------------- | --------- | ---------- | -------- | ------ | ------------- |
| **HTML**       | 1K lines  | 1.67M      | ~1.8ms   | < 1MB  | Apple Silicon |
| **JAVASCRIPT** | 1K lines  | 770K       | ~4ms     | < 1MB  | Apple Silicon |
| **LOG**        | 0K lines  | 680K       | ~0.15ms  | < 1MB  | Apple Silicon |

**Note**: Performance results are based on files containing actual dates. Files without dates are processed much faster but extract 0 dates.  
**Real-World Performance**: Tested with actual data up to 10MB (practical limit: 1MB warning, 5MB error threshold)  
**Performance Monitoring**: Built-in real-time tracking with configurable thresholds  
**Full Metrics**: [docs/PERFORMANCE.md](docs/PERFORMANCE.md) • Test Environment: macOS, Bun 1.2.22, Node 22.x

<!-- PERFORMANCE_END -->

## 🔧 Troubleshooting

**Not detecting dates?**  
Ensure file is saved with supported extension (.json, .yaml, .csv, .xml, .log, .html, .js, .ts)

**Large files slow?**  
Files over 5MB may take longer. Consider splitting into smaller chunks

**Need help?**  
Check [Issues](https://github.com/OffensiveEdge/dates-le/issues) or enable logging: `dates-le.telemetryEnabled: true`

## ❓ FAQ

**What date formats are extracted?**  
ISO 8601, RFC2822, Unix timestamps, UTC, local formats, and simple date patterns

**Can I analyze dates?**  
Yes, use the Analyze command for statistics, anomaly detection, and pattern recognition

**Max file size?**  
Up to 10MB. Practical limit: 5MB for optimal performance

**Perfect for log analysis?**  
Absolutely! Extract timestamps from server logs, application traces, and monitoring data

## 📊 Testing

**39 unit tests** • **15.4% overall coverage with 83.8% format coverage**  
Powered by Vitest • Run with `bun test --coverage`

---

Copyright © 2025
<a href="https://github.com/OffensiveEdge">@OffensiveEdge</a>. All rights reserved.
