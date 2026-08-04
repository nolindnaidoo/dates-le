# Changelog

All notable changes to Dates-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-08-03

### Changed

- Marketplace categories re-targeted for discovery. `Other` is dropped
  (65,992 extensions, no discovery value); each extension now sits in
  categories matching how it is actually used.

### Added

- Rating links in the in-extension help output, for both the VS Code
  Marketplace and Open VSX. Acquisitions exceed listing page views, so most
  users never see the listing's rating control; help is the surface they do
  reach.

## [2.0.0] - 2026-07-29

Full rehabilitation release. The headline: **v1.x VSIXes built from this
repo could not activate** — the build had no bundler while the package
excluded `node_modules`, so the extension crashed on load with
`Cannot find module 'vscode-nls'`. 2.0.0 ships a self-contained esbuild
bundle, verified by a packaging gate and a real extension-host
integration suite on every CI run.

### Fixed

- **Packaging**: `dist/extension.js` is now a single self-contained
  bundle (VSIX: 61 files → 21). A bundle gate (static require scan +
  loading the bundle with `vscode` stubbed) blocks any regression.
- **Command errors were invisible**: analyze/convert/filter/validate
  failures went to `console.error` only — users saw nothing. Errors now
  surface through notifications, with home directories and
  credential-shaped fragments redacted.
- **Dedupe/Sort/Extract**: whole-document replacement overshot the last
  line; dedupe counted removed blank lines as "duplicates".
- **Config**: non-numeric setting overrides fell back to the setting's
  floor instead of its default; the string `"false"` read as `true`;
  `openResultsSideBySide` defaulted `false` in code but `true` in the
  manifest (a parity test now pins every default); an undeclared
  `notificationLevel` (singular) key was consulted before the real one.
- **Status bar / telemetry**: both froze their enabled/disabled state at
  activation; they now react to setting changes without reload.

### Changed — extraction output

- **Real line/column positions everywhere**, derived from match offsets
  over the whole content instead of per-line loops.
- **Unix timestamps must be exactly 10 or 13 digits with no digit
  neighbors**: numeric IDs and `Number.MAX_SAFE_INTEGER` no longer
  surface their first 13 digits as an epoch.
- **Overlap dedupe is by offset containment, not substring comparison**:
  a `2024-01-15` cell next to an ISO date containing the same characters
  survives (v1.x deleted it); the bare date *inside* an ISO is still
  dropped. Applied uniformly — HTML and JS no longer emit the same
  attribute or constructor argument up to four times, and log no longer
  emits both the generic and log-pattern match for the same characters.
- **Repeated values on one line** are each reported with their own
  column (v1.x collapsed them; deduplication is the dedupe command).
- **JS/TS**: multi-line `new Date(…)`/`moment(…)`/etc. calls are now
  matched (previously missed); `.jsx`/`.tsx` language ids are supported.
- **XML**: inline and multiline comments are skipped (previously only
  lines *starting* with a comment), and line numbers after a comment are
  no longer shifted.
- **Log**: Apache access-log values lose their brackets and gain a real
  timestamp (previously always `NaN`); RFC 2822 accepts single-digit
  days.
- **Unparseable values are no longer emitted** with `NaN` timestamps.
- Extract's success toast reports a count, not a fabricated throughput.

### Removed

- 20 settings that were never read by any code path (`analysis.*`,
  `performance.*`, `keyboard.*`, `presets.*`, `dedupeEnabled`,
  `showParseErrors`, `csv.streamingEnabled`,
  `postProcess.openInNewFile`, `safety.largeOutputLinesThreshold`,
  `safety.manyDocumentsThreshold`). 7 real settings remain, and
  `notificationsLevel` is now actually wired: `all` shows everything,
  `important` shows warnings and errors, `silent` (the default) shows
  errors only.
- Three hidden, broken settings commands (export/import/reset) and the
  CSV "streaming" toggle — a flag no extractor ever read.
- The runtime vscode-nls layer, which never functioned (no bundles were
  ever generated); runtime strings are plain English. Manifest/settings
  translations (13 locales) are unaffected and now in full key parity.

### Infrastructure

- esbuild bundle + bundle gate; tsc is typecheck-only and now covers
  test files (~290 latent errors fixed or removed).
- Real coverage thresholds (the v1.x Vitest config used Jest's
  `threshold` key, which Vitest ignored) — 84% lines.
- Extraction behavior is pinned by characterization goldens; CI runs
  lint → typecheck → coverage → build → bundle gate → package →
  integration tests on a real extension host, on 3 OSes.

## [1.8.1] - 2025-11-02

- Added Regex-LE and Secrets-LE to the "More from the LE Family" README
  section.

## [1.8.0] - 2025-10-26

- Added unit tests around error handling and format validation.
  (Condensed — the tested error-handling layer was largely unreachable
  from the shipped extension, and the "zero critical vulnerabilities /
  enterprise-grade reliability" claims of the original entry did not
  hold: the packaged extension could not activate.)

## [1.7.0] - 2025-01-27

- Initial public release: date extraction for JSON, YAML, CSV, XML,
  logs, HTML, and JS/TS; analyze/convert/filter/validate/dedupe/sort;
  `Ctrl+Alt+D` / `Cmd+Alt+D`; manifest/settings translations.
  (Condensed — the original entry's throughput figures, "stream
  processing", and timezone-conversion claims described features that
  did not exist or numbers that were never reproduced.)
