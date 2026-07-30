# AGENTS.md — Dates-LE

Technical source of truth for this repo. README.md is the user-facing doc; this file is for anyone (human or agent) changing the code.

## What this is

A VS Code extension that extracts dates and timestamps from the active document (JSON, YAML, CSV, XML, logs/plaintext, JS/TS, HTML) into a results editor, with analyze/convert/filter/validate/dedupe/sort post-processing. No network access, no filesystem writes.

## Architecture

```
extension.ts            activate(): createServices() -> registerCommands()
services/serviceFactory createServices(context) -> { telemetry, notifier, statusBar }
commands/               one file per command; deps injected as a frozen bag
extraction/extract.ts   dispatcher: languageId -> FileType -> extractor
extraction/heuristics.ts  THE date-pattern core: BASE_PATTERNS + scanDates()
                          (whole-content d-flag regex, offset-containment dedupe,
                          Date.parse gate — NaN timestamps are never emitted)
extraction/position.ts    offset -> {line, column} via newline index (1-based)
extraction/formats/*.ts   per-format extractors; json/yaml/csv are plain
                          scanDates, xml masks comments first, log/js/html add
                          format-specific DatePatternSpec lists
analysis/statistics.ts  analyzeDates(): stats, anomalies, patterns, clusters, gaps
conversion/dateConverter.ts  convertDates() + getAvailableFormats()
ui/                     notifier (window messages, gated by notificationsLevel:
                        all -> everything, important -> warn+error, silent -> error only),
                        statusBar
utils/                  errors (sanitizeErrorMessage), safety (size guard)
config/config.ts        getConfiguration() snapshot; CONFIG_DEFAULTS table
types.ts                shared types only — no logic
```

Conventions: factory functions + `Object.freeze` (no classes), early returns, dependency bags typed inline at the consumer. Runtime strings are plain English; the 13 `package.nls*.json` catalogues localize **manifest** strings only (VS Code `%key%` substitution — do not add a runtime i18n layer without wiring real bundles).

## Invariants (things that were once broken — keep them true)

- **The bundle must be self-contained.** The VSIX ships `dist/extension.js` only; `scripts/check-bundle.js` (run in `vscode:prepublish` and CI) does a static require scan AND loads the bundle with `vscode` stubbed.
- **`CONFIG_DEFAULTS` must equal package.json defaults.** `config.test.ts` asserts parity over every declared setting; add new settings to both plus the KEY_MAP in the test.
- **Every declared setting must have a consumer.** v1 shipped 20 no-op settings; don't add a setting without wiring it.
- **Extractor behavior is pinned by golden snapshots** (`extraction/characterization.test.ts` + `__fixtures__/`). Any output change must update goldens in the same commit and be listed in the CHANGELOG. Goldens run with `TZ=UTC` (set in the test scripts — vitest worker threads don't pick up `process.env.TZ` assignments) and a faked clock (syslog borrows the current year).
- **Date patterns live in one place** (`extraction/heuristics.ts`). Never re-implement the base patterns inside a format extractor — add a `DatePatternSpec` instead; at identical offsets the earlier spec wins, so base classifications beat format-specific `custom` wrappers.
- **Unix epochs are exactly 10 or 13 digits with no digit neighbors** and must land in a plausible range — the v1.x pattern matched the first 13 digits of any longer number (IDs, phone numbers).
- **nls catalogues stay in key-parity:** all 12 locale files carry exactly the keys of `package.nls.json`.

## Toolchain

- **Build:** esbuild bundle (`bun run build`, `build:prod` minified). `tsc` is typecheck-only (`noEmit`) and covers test files.
- **Unit tests:** vitest; `vscode` aliased to `src/__mocks__/vscode.ts` (stateful mock with `_reset/_set` helpers, quick-pick/input-box responders, `withProgress`). Coverage thresholds enforced: 80 lines / 80 funcs / 75 branches / 80 stmts.
- **Integration tests:** `bun run test:integration` — `@vscode/test-cli` launches a real VS Code (config in `.vscode-test.mjs`, tests compiled via `tsconfig.it.json` to `out-test/`).
- **Lint/format:** Biome (tabs, single quotes). `__fixtures__`/`__snapshots__` are exempt — formatting fixtures would corrupt goldens.
- **Packaging:** `bun run package` → `release/*.vsix`. `.vscodeignore` is an allow-list; the VSIX is ~21 files.

## Release

1. Bump `version` in package.json, add a CHANGELOG entry.
2. CI green on all 3 OSes (includes packaging + integration tests).
3. `Release` workflow (manual dispatch) publishes to the VS Code Marketplace (`VSCE_PAT`) and Open VSX (`OVSX_PAT`) — Open VSX is what Cursor/VSCodium users install from. Locally: `bun run package` then `vsce publish` / `ovsx publish`.

## Known limitations (documented, not bugs)

- `M/D/YYYY` local dates assume US ordering (`1/5/2024` is January 5).
- Syslog lines carry no year; the current year is assumed, so year-old
  logs get current-year timestamps.
- Extraction is regex-based: date-shaped strings in comments or
  arbitrary string literals are extracted (only XML comments are
  masked).
- `Date.parse` leniency is inherited: `2024-02-30` rolls over to
  March 1 rather than being rejected.
