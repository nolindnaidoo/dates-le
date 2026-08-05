# Changelog

All notable changes to Dates-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-08-05

### Added

- Runtime strings are localized, and this time they render. All 56 of them —
  notifications, status bar, quick-picks and prompts — go through
  `vscode.l10n` and ship as twelve translated bundles in `l10n/`. The v1.x
  line carried manifest catalogues that worked and runtime catalogues that
  never reached the screen: `vscode-nls` was configured without
  `__filename`, so every runtime string fell back to English while the VSIX
  looked correct.
- An integration test covering both localization mechanisms — manifest
  substitution, key parity across all thirteen catalogues, and placeholder
  integrity in every translation. A translation that silently drops `{0}`
  now fails the build instead of shipping a message with the value missing.

- Dependency review on pull requests, failing on a high-severity addition
  before Dependabot's auto-merge can act.

### Fixed

- Extraction reported success for an in-place replacement that was never
  applied. `vscode.workspace.applyEdit` returns `false` when an edit is
  rejected — a read-only document, or one that changed underneath the command
  — and `openResults` discarded that and returned `true` regardless, so the
  caller's failure branch could not fire. The result is now propagated, with a
  test that drives a rejected edit.
- Dedupe and sort had the same defect one layer down. The shared
  `replaceDocumentContent` helper returned `void`, swallowing the rejection, so
  both announced "Removed 3 duplicate dates" or "Sorted 12 dates" over a
  document that still held its original text. The helper now returns whether
  the edit landed and both callers report a failure instead.
- The oversized-clipboard warning was never localized.
- The `vscode` test mock honours `validateInput`. VS Code will not hand a
  command a value its own validator rejected; the mock ignored it and returned
  whatever the test supplied, which let tests drive commands with input the
  real UI could never deliver.

- Date spans in the analysis report were formatted by an elapsed-time
  formatter, so a year of dates read "8760.00h" instead of "365 days". A
  second formatter of the same name and signature lived in the statistics
  module and only emitted days or hours, rendering a 45-minute gap as
  "0 hour" — wrong unit and mispluralised. Both fed the same report, so one
  gap could appear as "Gap of 3 days" on one line and "Duration: 72.00h" on
  the next. There is now one `formatDateSpan` covering milliseconds through
  days, with tests on every unit boundary.
- Dates that failed to convert were dropped silently. The only record was a
  `console.warn` written to the extension host log, which users do not open,
  while the report's "Total Dates Converted" simply came up short of the
  number of dates found. The report now states how many were skipped.
- Safety warnings, quick-pick details and format counts were never localized,
  along with all 18 progress messages — progress text goes through
  `progress.report()` rather than a property the localization pass inspected.

### Changed

- Every `else` block is gone (4 of them), replaced by guard clauses and early
  returns.
- Filter and Validate each held registration, the prompts, the run and the
  report in one file (453 and 413 lines). The reports moved to
  `commands/filterReport.ts` and `commands/validateReport.ts`, leaving 374 and
  256.

- Test coverage raised from 61.70% to 79.36% of branches (79.65% to 87.48% of
  statements), moving the repo from 1.70 points above the branch floor — the
  narrowest margin in the family — to 19.36, with no file left below any of
  the repo's own floors. The gap was in the three
  quick-pick-driven commands: `filter.ts` (36.78% to 63.21%), `validate.ts`
  and `analyze.ts`. Every branch past the first in those files is reachable
  only by answering a multi-select, and the existing suite covered the
  no-editor and no-dates cases only, so the filter kinds, the validation
  rule predicates and each conditional section of the analysis report were
  never exercised. The same was true of extract's output routing, all four
  sort modes and the comparator's unparseable-line handling.


- Seven redundant `as DateFormat` casts removed — the enclosing return type
  already provided the contextual type — and the filter command's options
  builder no longer hand-maintains a mutable mirror of its interface, so the
  last type assertion in the codebase is gone.
- `fullDocumentRange` (three copies) and `replaceDocumentContent` (two) are
  defined once in `utils/document.ts`. Three copies of the edit that replaces
  the user's entire document is three places to get it wrong.
- CI gains fleet-wide checks that no single repo can perform: shared config is
  compared across all ten extensions, and every README link is verified —
  including Open VSX links, which are checked against the API because
  open-vsx.org answers HTTP 200 for extensions that do not exist.

## [2.0.1] - 2026-08-04

### Changed

- Marketplace categories re-targeted for discovery. `Other` is dropped
  (65,992 extensions, no discovery value); each extension now sits in
  categories matching how it is actually used.
- Search keywords widened to 30, targeting the terms users actually type
  rather than internal vocabulary.
- Toolchain moved to current: TypeScript 7, vitest 4, Biome 2.5.7,
  @types/node 26. `@types/vscode` is now pinned exactly to the
  `engines.vscode` floor — the caret had let the type surface drift 15
  minors ahead of the version actually supported.
- Runtime dependencies updated across majors where present: csv-parse 7,
  ini 7, js-yaml 5. Extraction output is unchanged, verified against the
  characterization goldens.
- Packaging no longer walks the npm tree (`vsce package --no-dependencies`).
  The bundle is self-contained, so the walk served no purpose and failed
  after any dependency change. Scrape-LE keeps it, since it genuinely
  ships `playwright-core`.
- Documentation claims corrected against the code. Removed: Numbers-LE
  "with statistics", EnvSync-LE "visual diffs", Regex-LE "live feedback",
  String-LE "and validation" — none of those features exist.

### Added

- Rating links in the in-extension help output, for both the VS Code
  Marketplace and Open VSX. Acquisitions exceed listing page views, so most
  users never see the listing's rating control; help is the surface they do
  reach.
- README now carries measured Performance and Testing sections, both
  generated rather than written — from `scripts/benchmark.ts` and from the
  coverage summary. CI fails if the coverage numbers drift from a real run.
- Coverage thresholds enforced at 75 lines / 80 functions / 60 branches /
  75 statements.
- CodeQL scanning, Dependabot with grouped weekly updates, and auto-merge
  limited to patch and minor devDependency bumps that pass CI.

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
