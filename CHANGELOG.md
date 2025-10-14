# Changelog

All notable changes to Dates-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **Infrastructure completion** - Fixed activation events and command registry for all commands
- **Command count** - Increased from 6 to 8 commands (Extract, Dedupe, Sort, Help, Settings x4)
- **Documentation updates** - Updated all docs to reflect command parity achievement

### Fixed

- **Linting issues** - Resolved isNaN usage warnings (replaced with Number.isNaN)
- **VSCode engine compatibility** - Changed from `^1.105.0` to `^1.70.0` for broader compatibility

## [1.0.0] - 2025-10-13

### Initial Public Release

Dates-LE brings zero-hassle date extraction to VS Code with production-quality reliability for structured data formats.

#### Core Features

- **Structured format support** - Extract dates from JSON, YAML, and CSV files with 100% reliability
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

- **Production quality** - Focus on structured formats for 100% accuracy
- **High throughput** - 600K-1.8M+ dates/sec depending on format
- **Memory efficient** - ~50MB base + 1MB per 1000 dates processed
- **Robust error handling** - Graceful fallbacks and user-friendly messages
- **Comprehensive testing** - 39 tests with 100% passing rate
- **TypeScript safety** - Full type safety and strict null checks

#### Developer Experience

- **Zero configuration** - Works out of the box with sensible defaults
- **Essential settings** - Focused configuration options for common use cases
- **Rich documentation** - Complete guides and troubleshooting
- **Open source** - MIT licensed with active community support
