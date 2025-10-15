# Changelog

All notable changes to Dates-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2025-01-27

### Fixed

- **Command palette completeness** - Added missing `dates-le.postProcess.dedupe` and `dates-le.postProcess.sort` commands to command palette
- **User experience** - All post-processing commands now accessible via command palette for consistent workflow

### Technical

- Fixed command palette inconsistency where dedupe and sort commands were defined but not accessible
- Maintained 100% backward compatibility with existing installations

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

- **Internationalization infrastructure** - Implemented vscode-nls with MessageFormat.file for robust localization
- **User experience** - All commands, settings, and notifications now adapt to user's VS Code language preference
- **Documentation** - Updated README to reflect multi-language support capabilities
- **Marketplace discoverability** - Enhanced with localized descriptions and keywords

### Technical

- Created comprehensive localization files for 12 languages with 46+ translated strings each
- Implemented proper i18n patterns following VS Code extension best practices
- All existing functionality works seamlessly across all supported languages
- Maintained 100% backward compatibility with English-only installations
- Localization covers: commands, settings, notifications, error messages, and help content

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

### Technical

- Created XML parser with robust date pattern matching
- All existing commands (extract, dedupe, sort, help) work seamlessly with XML files
- Supports nested date formats and handles malformed XML gracefully
- Maintained 100% backward compatibility with existing functionality

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
