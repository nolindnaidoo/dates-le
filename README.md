<p align="center">
  <img src="src/assets/images/icon.png" alt="Dates-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Dates-LE: Zero Hassle Date Extraction</h1>
<p align="center">
  <b>Pull every date and timestamp out of the current file in one keystroke</b><br/>
  <i>JSON, YAML, CSV, XML, logs, HTML, JavaScript, and TypeScript</i>
</p>

<p align="center">
  <a href="https://open-vsx.org/extension/nolindnaidoo/dates-le">
    <img src="https://img.shields.io/badge/Install%20from-Open%20VSX-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from Open VSX" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le">
    <img src="https://img.shields.io/badge/Install%20from-VS%20Code-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from VS Code Marketplace" />
  </a>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Dates-LE Demo" style="max-width: 100%; height: auto;" />
</p>

## What it does

Open a file, press `Ctrl+Alt+D` (`Cmd+Alt+D` on Mac), and every date in the document lands in a new editor — deduplicate, sort, analyze, convert, filter, or validate it from there. Works in VS Code and in VS Code–based editors like Cursor and VSCodium (installable from Open VSX).

- **Log analysis** — timestamps from server logs: ISO, syslog, and Apache access-log formats
- **Data review** — dates and epochs from JSON, YAML, CSV, and XML
- **Code audit** — date literals and `new Date()`/`Date.parse()`/`moment()`/`dayjs()`/`DateTime.fromISO()` arguments in JS/TS, including calls formatted across multiple lines

## Supported formats

| Format | Language IDs | What gets extracted |
|---|---|---|
| JSON | `json` | Every recognized date pattern in the content |
| YAML | `yaml`, `yml` | Every recognized date pattern in the content |
| CSV | `csv` | Every recognized date pattern, cell by cell |
| XML | `xml` | Date patterns outside comments (inline and multiline comments are skipped) |
| Log / plain text | `log`, `plaintext` | Everything above plus `YYYY-MM-DD HH:mm:ss` log lines, syslog (`Mon DD HH:mm:ss`), and Apache access-log timestamps |
| JavaScript / TypeScript | `javascript`, `javascriptreact`, `typescript`, `typescriptreact` | Everything above plus string arguments to `new Date()`, `Date.parse()`, `moment()`, `dayjs()`, `DateTime.fromISO()` |
| HTML | `html` | Everything above plus `datetime` attributes, date-bearing `<meta>` tags, and JSON-LD `datePublished`/`dateModified` |

Recognized date patterns: ISO 8601 (`2024-01-15T10:30:00Z`, with optional milliseconds and offset), RFC 2822 (`Mon, 15 Jan 2024 10:30:00 GMT`), Unix epochs (exactly 10 or 13 digits in a plausible range — digits embedded in longer numbers are never matched), UTC strings, US-style `M/D/YYYY HH:mm:ss`, and bare `YYYY-MM-DD`. Every occurrence is reported with its real line and column. Values that cannot be parsed to a timestamp are not extracted.

Known limitations: `M/D/YYYY` assumes US ordering; syslog lines carry no year, so the current year is assumed.

## Commands

| Command | Description |
|---|---|
| `Dates-LE: Extract Dates` (`Ctrl+Alt+D` / `Cmd+Alt+D`) | Extract all dates from the active document |
| `Dates-LE: Analyze Dates` | Statistics, patterns, clusters, gaps, and anomalies |
| `Dates-LE: Convert Dates` | Convert extracted dates to ISO, RFC 2822, Unix, UTC, local, simple, or a custom format |
| `Dates-LE: Filter Dates` | Filter by range, format, duplicates, future/past |
| `Dates-LE: Validate Dates` | Check extracted dates against selectable rules |
| `Dates-LE: Deduplicate Dates` | Remove duplicate lines from the results |
| `Dates-LE: Sort Dates` | Sort results chronologically or alphabetically |
| `Dates-LE: Open Settings` | Open Dates-LE settings |
| `Dates-LE: Help` | Built-in documentation |

## Settings

| Setting | Default | Description |
|---|---|---|
| `dates-le.openResultsSideBySide` | `true` | Open results beside the current editor |
| `dates-le.copyToClipboardEnabled` | `false` | Also copy results to the clipboard |
| `dates-le.notificationsLevel` | `silent` | `all` = every notification, `important` = warnings + errors, `silent` = errors only |
| `dates-le.safety.enabled` | `true` | Guardrails for very large files |
| `dates-le.safety.fileSizeWarnBytes` | `1000000` | Refuse extraction above this file size |
| `dates-le.statusBar.enabled` | `true` | Show the status bar item |
| `dates-le.telemetryEnabled` | `false` | Local-only event log (see Privacy) |

The settings UI is translated into 12 languages besides English.

## Privacy & security

- **No network access.** The extension never sends data anywhere. The `telemetryEnabled` setting only writes events to a local Output Channel you can inspect (`Dates-LE Telemetry`).
- Error notifications redact home directories and credential-shaped fragments.

## Development

```bash
bun install
bun run build            # esbuild bundle -> dist/extension.js
bun run typecheck        # tsc --noEmit (includes tests)
bun run test             # vitest unit suite
bun run test:integration # real VS Code extension host
bun run lint             # biome
bun run package          # VSIX into release/
```

Architecture and conventions live in [AGENTS.md](AGENTS.md). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## More from the LE Family

- **[Paths-LE](https://open-vsx.org/extension/nolindnaidoo/paths-le)** - Extract file paths from imports, assets, and configs • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le)
- **[String-LE](https://open-vsx.org/extension/nolindnaidoo/string-le)** - Extract user-visible strings for i18n and validation • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.string-le)
- **[Numbers-LE](https://open-vsx.org/extension/nolindnaidoo/numbers-le)** - Extract and analyze numeric data with statistics • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le)
- **[EnvSync-LE](https://open-vsx.org/extension/nolindnaidoo/envsync-le)** - Keep .env files in sync with visual diffs • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.envsync-le)
- **[Regex-LE](https://open-vsx.org/extension/nolindnaidoo/regex-le)** - Test and validate regex patterns with live feedback • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.regex-le)
- **[Secrets-LE](https://open-vsx.org/extension/nolindnaidoo/secrets-le)** - Detect and sanitize secrets before you commit • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.secrets-le)
- **[Scrape-LE](https://open-vsx.org/extension/nolindnaidoo/scrape-le)** - Validate scraper targets before debugging • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.scrape-le)
- **[Colors-LE](https://open-vsx.org/extension/nolindnaidoo/colors-le)** - Extract and analyze colors from stylesheets • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le)
- **[URLs-LE](https://open-vsx.org/extension/nolindnaidoo/urls-le)** - Extract URLs from any codebase with precision • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.urls-le)

## License

MIT © [nolindnaidoo](https://github.com/nolindnaidoo)
