# Changelog

All notable changes to Dates-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file covers the **VS Code extension**. The Rust CLI in `crate/` is a
separate product on its own cadence and keeps its own
[CHANGELOG](crate/CHANGELOG.md).

## [2.3.1] - 2026-08-16

### Changed

- **New icon artwork.** A new drawing in the style the family is moving
  to, framed like the rest of the set.

### Fixed

- **The agent-files check no longer times out on Windows.** A test-only
  fix; nothing a user of the extension can observe.

## [2.3.0] - 2026-08-14

The release where Dates-LE reads the documents you already expected it
to read, and stops calling long numbers dates.

**Expect the count to go up, and expect none of the old ones to be
missing.** Every date the previous version found is still found; what is
new is documents that were never scanned and notations that were never
resolved. On one large tree the equivalent scan went from 488 dates to
615.

### Added

- **Every document is read.** `extractDates` returned an empty result for
  any language id outside the nine it knew — indistinguishable from a
  file with no dates in it — so Python, Go, Rust, TOML and Markdown
  produced nothing. A format only ever *adds* patterns to the shared
  ones, so `unknown` now routes to the shared scan, and `toml`, `ini`,
  `cfg`, `conf`, `properties`, `markdown` and `md` resolve as names of
  their own. `toml` and `markdown` join the MCP tool's format enum, and
  activation is `onStartupFinished` rather than a language allow-list
  that could only ever be wrong in one direction.
- **Four date shapes that appear in real files and that JavaScript
  cannot read at all**: ISO 8601 week dates (`2024-W03`), ordinal dates
  (`2024-015`), the basic format (`20240115T103045Z`), and the timezone
  abbreviations `CEST CET BST JST AEST IST` as fixed offsets. Every one
  of them is `NaN` to `Date.parse`, so every one of them used to be
  dropped on the floor.

  `week`, `ordinal` and `basic` are new `DateFormat` values, which is
  worth knowing if you filter on that field. Each shape is normalised
  into a string `Date.parse` *does* read rather than resolved here, so
  the Rust CLI holds the identical rule. `IST` names three zones — India,
  Ireland and Israel — and India is the one taken.
- **Unix epochs in microseconds and nanoseconds** — 16 and 19 digits,
  truncated to the millisecond by character rather than by division,
  because 19 digits do not fit a double.

### Changed

- **`extract_dates` no longer refuses a call with no usable format.**
  `resolveFormat` yields `unknown` rather than null, and the answer
  carries it as `fileType`, so an agent that cannot name a document still
  gets its dates.
- **A long run of digits now has to be a plausible date, not merely the
  right length.** This is the one change here that can remove something
  from your results, and it has two halves.

  What it removes: a 13-, 16- or 19-digit run is read as a timestamp only
  if it lands on or after 2001-09-09 and before 2100-01-01. A card number
  was being reported as a date in 2113, `Number.MAX_SAFE_INTEGER` as
  2255, and a 13-digit request id in this project's own fixture as
  December 2282.

  What it costs: a genuinely far-future timestamp written in
  milliseconds, microseconds or nanoseconds is no longer reported. Those
  units are machine-stamped — `Date.now()`, `time.time_ns()` — and record
  when a program ran; a cutoff a person writes is a date or a seconds
  epoch. If you keep the year 2200 in milliseconds, this release stops
  seeing it.

  Past 10 digits the digit count stops bounding anything: every 13-, 16-
  or 19-digit numeral already lands in 2001–2286, so the old floor
  excluded nothing at all.

- **The 10-digit rule is unchanged, and it still has one honest false
  positive.** A 10-digit phone number is a valid seconds epoch and reads
  as 2145-11-29. Nothing about its shape or its instant can tell it from
  a real timestamp, so it stays pinned in the corpus as the false
  positive it is rather than hidden behind a rule that would also throw
  away real dates.

  Still unsupported, and not implied anywhere: DD/MM/YYYY ordering —
  `15/1/2024 10:30:45` is a refusal rather than 15 January — and month
  names outside English.

- A **Rust CLI and MCP server** in [`crate/`](crate/README.md), to be
  published to crates.io as `dates-le`. It runs the same extraction over
  a whole tree, resolves every value to the instant it actually means,
  and can filter and sort by that instant — so "what dates in here have
  already passed" becomes one command.

  Only extraction is ported; analyze, convert, filter and validate are
  interactive and stay here. The extension remains the reference
  implementation and `crate/fixtures/` is the contract between the two.

- **New icon artwork.** All sixteen tools were redrawn in one style, so
  the family reads as one set wherever the listings sit side by side —
  the Marketplace, Open VSX and letools.dev. The framing is unchanged:
  the drawing fills 65.8% of an 800×800 canvas, and every smaller size
  is derived from that one file rather than drawn again.

## [2.2.4] - 2026-08-07

### Changed

- Documentation only — no behaviour change.

  The cross-references now point at each tool's own page on letools.dev rather
  than its VS Code Marketplace listing. The Marketplace listing shows one of
  the four channels a tool ships through; the detail page shows all of them,
  which is what a reader following a link from another tool is looking for.
  Install instructions are untouched, and the rating links now lead with Open
  VSX — where the audience these READMEs reach actually installs from.

- `homepage` in the extension and MCP manifests, and `websiteUrl` in the
  registry entry, resolve to the same detail page.

## [2.2.3] - 2026-08-05

### Changed

- Documentation and packaging metadata only — no behaviour change.

  The MCP server's source now explains its decisions rather than restating its
  code: why MCP's stdio transport is line-delimited and what happens to a client
  if you copy LSP's framing, why a tool failure is a result carrying `isError`
  rather than a JSON-RPC error and what each does to a model's next move, why
  the result cap is measured in context windows rather than milliseconds, and
  why `truncated` matters more than the cap itself.

- The npm package declares `publishConfig.provenance`, so a release published
  from CI carries a Sigstore attestation binding the tarball to the commit and
  workflow that built it. A consumer can verify it with `npm audit signatures`.

- The registry entry names its registry (`registryBaseUrl`) and how to run the
  package (`runtimeHint`), rather than leaving a client to infer both.

- Package metadata points at the author's site, and the npm page links the rest
  of the family, the Rust tools and their crates.

## [2.2.2] - 2026-08-05

### Changed

- Documentation only — no behaviour change.

  The README described a keyboard shortcut and little else. 2.2.1 added an MCP
  server that VS Code registers with agent mode, published it to npm and to the
  official MCP registry, and submitted a Zed extension — and a reader could
  discover none of it from this page. There is now a section for calling the
  tool from an agent, including the JSON config for hosts that use one and a
  one-line check that the server answers before you wire it into anything.

  The privacy section previously spoke only for the extension. It covers the
  server too, which is the part an agent actually runs.

  The registry listing gains a display name, an icon and a link to letools.dev;
  the npm page gains the badges and links it was missing. Every surface now
  points at the others.

## [2.2.1] - 2026-08-05

### Changed

- **VS Code 1.101 is now the minimum.** `engines.vscode` moves from `^1.90.0`
  to `^1.101.0` and `@types/vscode` is pinned exactly to the new floor, per the
  rule that the declared floor and the type surface must match. 1.101 is the
  first stable release carrying `registerMcpServerDefinitionProvider`, which
  the MCP integration needs — declaring the contribution point against an older
  floor would be a claim the code could not honour. Cursor and VSCodium track
  well past this; Cursor 3.6.21 reports 1.105.1.

### Added

- An MCP server, shipped inside the VSIX as `dist/mcp-server.js`. It exposes
  `extract_dates` over stdio, so an agent can pull every date out of a document
  with its 1-based position.

  It imports the extraction engine and nothing from `vscode` —
  `check:mcp-bundle` fails the build if that stops being true, because the
  server has to run in Zed, in Claude Code, and from `npx`.

- The extension now offers that server to VS Code's agent mode, so installing
  it adds `extract_dates` to the agent's tools alongside the existing commands.
  Nothing is downloaded at runtime: the server is the copy inside the VSIX.
  The registration is skipped on editors that do not implement the API, which
  is not an error — an editor without agent mode is not a broken install.

- The server is on npm as [`dates-le-mcp`](https://www.npmjs.com/package/dates-le-mcp),
  so `npx dates-le-mcp` gives the same tool to Claude Code, Cursor, Windsurf or
  anything else that speaks MCP. It is the same build the VSIX carries, and its
  version is written from this manifest rather than maintained separately.

- A **Zed extension**, under `zed/`. Zed's extension API has no way to read the
  active buffer or register a command, so this extension could never be ported
  there in any language; a context server is the surface that fits. The crate
  is a launcher — it installs `dates-le-mcp` and starts it with Zed's Node — so
  there is no second implementation to keep in agreement with the goldens.

  Two things the boundary fixes rather than the engine, whose behaviour is
  pinned by goldens: an unrecognised language makes `extractDates` return an
  empty result with no error, which reads as "this document has no dates", so
  the tool refuses up front with a message naming the supported formats; and
  the engine's severity scale has three levels against a diagnostic's two, so
  `critical` collapses into `error` rather than being reported as the milder
  warning.

### Fixed

- The coverage gate could pass against a stale summary. `coverage-readme.js`
  reads `coverage/coverage-summary.json` rather than running coverage, so when
  that file was older than the code both modes lied — the rewrite reproduced
  stale numbers and `--check` then compared the README against the same stale
  file and reported it current. Both modes now refuse a summary older than
  `src/`.

- The manifest placeholder gate only inspected `contributes.commands`, so a
  `%key%` on any other contribution point could ship as literal text. It now
  walks the whole `contributes` tree.

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
