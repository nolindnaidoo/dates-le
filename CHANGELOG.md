# Changelog

All notable changes to Dates-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2025-01-27

### Initial Public Release

Dates-LE brings zero-hassle date extraction to VS Code. Simple, reliable, focused.

#### Supported File Types

- **JSON** - API responses and configuration files
- **YAML** - Configuration and data files
- **CSV** - Data exports and analysis files
- **XML** - Structured data and metadata
- **Log files** - Server logs and application traces
- **HTML** - Web content and metadata
- **JavaScript/TypeScript** - Code analysis and timestamps

#### Date Formats

- **ISO 8601** - 2023-12-25T10:30:00Z, 2023-12-25T10:30:00.000Z
- **RFC 2822** - Mon, 25 Dec 2023 10:30:00 GMT
- **Unix timestamps** - 1703506200, 1703506200000
- **Custom formats** - Various regional and application-specific formats

#### Features

- **Multi-language support** - Comprehensive localization for 12+ languages
- **High-performance processing** - Benchmarked for massive throughput:
  - JSON: 37,977 dates/sec
  - CSV: 24,649 dates/sec
  - LOG: 680,000 dates/sec
  - YAML: 139,510 dates/sec
  - HTML: 1.56M dates/sec
  - JavaScript: 1.44M dates/sec
- **Advanced analysis** - Statistics, anomalies, and pattern detection
- **Format conversion** - Between formats and timezones
- **Smart filtering** - By ranges, formats, or conditions
- **Validation rules** - Configurable date validation
- **One-command extraction** - `Ctrl+Alt+D` (`Cmd+Alt+D` on macOS)
- **Stream processing** - Handle large datasets without locking VS Code
- **Developer-friendly** - 39+ passing tests, TypeScript strict mode, functional programming, MIT licensed

#### Use Cases

- **Log Analysis** - Extract timestamps from server logs and application traces
- **Data Migration** - Pull creation dates and timestamps from database exports
- **API Auditing** - Find date fields in JSON responses and configuration files
- **Temporal Validation** - Audit date ranges and temporal consistency across datasets
