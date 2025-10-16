# Changelog

All notable changes to Dates-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.5] - 2025-01-27

### Added

- **Date Conversion & Formatting** - Convert dates between different formats and timezones
  - Convert dates to ISO 8601, RFC 2822, Unix timestamps, UTC, local, and custom formats
  - Timezone conversion support for common timezones
  - Custom date format strings with validation
  - Relative time formatting (e.g., "2 days ago", "in 3 hours")
- **Advanced Post-Processing Commands** - Comprehensive date manipulation tools
  - **Convert Command** - Convert dates to different formats with interactive format selection
  - **Filter Command** - Advanced filtering with date ranges, format inclusion/exclusion, and custom filters
  - **Validate Command** - Comprehensive date validation with configurable rules and severity levels
- **Enhanced Date Validation** - Multi-level validation system
  - Format validation, future date detection, reasonable date range checks
  - ISO 8601 compliance validation and timezone consistency checks
  - Configurable validation rules with error, warning, and info severity levels
  - Detailed validation reports with suggestions for fixing issues

### Changed

- **Command Palette** - Added convert, filter, and validate commands to available commands
- **User Experience** - All new commands provide detailed reports and interactive configuration

## [1.4.0] - 2025-01-27

### Added

- **Advanced Analysis & Statistics** - Comprehensive date analysis with statistical insights
  - Statistical analysis: total, unique, duplicates, date ranges, averages, and medians
  - Anomaly detection: future dates, invalid dates, outliers, and format inconsistencies
  - Pattern detection: frequency patterns, seasonal patterns, and trend analysis
  - Date clustering: temporal proximity grouping with density analysis
  - Temporal gap detection: identify missing date sequences
- **Enhanced File Format Support** - Extended support for additional file types
  - **Log files** (.log, .txt) - Extract dates from application logs, syslog, Apache logs
  - **JavaScript/TypeScript** (.js, .ts, .jsx, .tsx) - Extract dates from code, including Date constructors and library calls
  - **HTML files** (.html) - Extract dates from datetime attributes, meta tags, and JSON-LD
- **Analyze Command** - New command for comprehensive date analysis
  - Access via Command Palette: "Dates-LE: Analyze Dates"
  - Generates detailed analysis reports with statistics, anomalies, and patterns
  - Opens results in markdown format for easy review

### Changed

- **File Format Recognition** - Extended context menu support to new file formats
- **Command Palette** - Added analyze command to available commands
- **Activation Events** - Added support for JavaScript, TypeScript, HTML, and log file languages

## [1.3.1] - 2025-01-27

### Fixed

- **Command palette completeness** - Added missing `dates-le.postProcess.dedupe` and `dates-le.postProcess.sort` commands to command palette
- **User experience** - All post-processing commands now accessible via command palette for consistent workflow

## [1.3.0] - 2025-01-27

### Added

- **Multi-language support achievement** - Added comprehensive localization for 12 additional languages
- **German (de)** - Vollständige deutsche Lokalisierung für alle Benutzeroberflächen-Elemente
- **Spanish (es)** - Soporte completo en español para comandos, configuraciones y mensajes
- **French (fr)** - Localisation française complète pour l'interface utilisateur
- **Indonesian (id)** - Dukungan bahasa Indonesia lengkap untuk semua fitur
- **Italian (it)** - Localizzazione italiana completa per comandi e impostazioni
- **Japanese (ja)** - コマンド、設定、メッセージの完全な日本語サポート
- **Korean (ko)** - 모든 사용자 인터페이스 요소에 대한 완전한 한국어 지원
- **Portuguese (Brazil) (pt-br)** - Suporte completo em português brasileiro
- **Russian (ru)** - Полная локализация на русском языке для всех элементов интерфейса
- **Ukrainian (uk)** - Повна локалізація українською мовою для всіх елементів інтерфейсу
- **Vietnamese (vi)** - Hỗ trợ tiếng Việt đầy đủ cho tất cả các tính năng
- **Chinese Simplified (zh-cn)** - 简体中文完整支持，包括命令、设置和消息

### Changed

- **User experience** - All commands, settings, and notifications now adapt to user's VS Code language preference
- **Documentation** - Updated README to reflect multi-language support capabilities
- **Marketplace discoverability** - Enhanced with localized descriptions and keywords

## [1.2.0] - 2025-10-14

### Added

- **File type parity achievement** - Added support for XML files
- **XML file support** - Extract dates from XML build configs, Maven POM files, Ant build scripts
- **Comprehensive date format parsing** - Supports ISO 8601, RFC 2822, Unix timestamps, UTC, local, and simple date formats
- **Build timestamp extraction** - Specialized support for Maven, Gradle, and Ant timestamp patterns
- **Sample file** - Added build.xml example demonstrating various XML date formats

### Changed

- **Activation events** - Added `onLanguage:xml` for XML file recognition
- **Context menus** - Extended to support .xml file extensions
- **Documentation** - Updated README with XML support and expanded FAQ section
- **Keywords** - Added "xml", "maven", "gradle" for marketplace discoverability

## [1.1.0] - 2025-10-14

### Added

- **Command parity achievement** - Full parity with other LE extraction extensions
- **Deduplicate command** - Added `dates-le.postProcess.dedupe` to remove duplicate dates while preserving order
- **Sort command** - Added `dates-le.postProcess.sort` with 4 interactive sort modes:
  - Chronological (Oldest First)
  - Reverse Chronological (Newest First)
  - Alphabetical (A → Z)
  - Alphabetical (Z → A)
- **Comprehensive documentation** - Added complete command list to README with examples
- **Extended COMMANDS.md** - Full documentation for all post-processing commands
- **i18n support** - Localized command titles for dedupe and sort

### Changed

- **Command accessibility** - All post-processing commands now properly registered and accessible
- **Documentation updates** - Updated all docs to reflect command parity achievement

### Fixed

- **Linting issues** - Resolved isNaN usage warnings (replaced with Number.isNaN)
- **VSCode engine compatibility** - Changed from `^1.105.0` to `^1.70.0` for broader compatibility

## [1.0.0] - 2025-10-13

### Initial Public Release

Dates-LE brings zero-hassle date extraction to VS Code with production-quality reliability for structured data formats.

#### Core Features

- **Structured format support** - Extract dates from JSON, YAML, and CSV files with reliable parsing
- **Multiple date formats** - ISO 8601, RFC 2822, Unix timestamps, UTC, local, and simple date patterns
- **Smart validation** - Timestamp range validation (2001-2286) prevents false positives from version numbers
- **Deduplication** - Optional automatic removal of duplicate dates from results

#### User Experience

- **One-command extraction** - `Ctrl+Alt+D` (`Cmd+Alt+D` on macOS)
- **Side-by-side results** - Open results alongside your source files
- **Progress indicators** - Real-time feedback during extraction
- **Clipboard integration** - Optional automatic copying to clipboard
- **Safety warnings** - Alerts for large files and output
- **English interface** - Clean, professional English-only interface

#### Performance & Reliability

- **Production quality** - Focus on structured formats for reliable accuracy
- **High throughput** - Optimized performance for large datasets
- **Memory efficient** - ~50MB base + 1MB per 1000 dates processed
- **Robust error handling** - Graceful fallbacks and user-friendly messages
- **Comprehensive testing** - 39 tests with 100% passing rate
- **TypeScript safety** - Full type safety and strict null checks

#### Developer Experience

- **Zero configuration** - Works out of the box with sensible defaults
- **Essential settings** - Focused configuration options for common use cases
- **Rich documentation** - Complete guides and troubleshooting
- **Open source** - MIT licensed with active community support
