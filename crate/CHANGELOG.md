# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-11

First release. The extension's extraction engine, ported and pinned
against a shared corpus, over a tree instead of one open document.

### Added

- **Extraction for all nine format names** the extension reads — JSON,
  YAML, CSV, XML, log, plaintext, JavaScript, TypeScript and HTML —
  reproducing its values, notations, instants and positions for every
  case in `fixtures/`. `typescript` and `plaintext` stay their own keys
  rather than aliases of `javascript` and `log`, because the key is
  user-visible as `fileType` and the two servers must not disagree about
  what they just read.
- **`Date.parse` as V8 implements it**, both parsers: the ECMA-262 Date
  Time String Format and the legacy one no standard describes. Its rules
  were established by asking V8 and are pinned in
  `fixtures/date-parse.json`, 140 cases that `cargo test` replays —
  garbage words legal before the first number and fatal after it,
  weekday names read and discarded, months matched on three letters,
  `EST` a fixed −5 rather than a zone, a two-digit year 1900s from 50,
  parenthesised comments skipped closed or not, and the ISO parser
  committing at the `T` so that `2024-01-15T10:30:45 GMT` is a refusal
  while `2024-01-15 10:30:45` is not.
- **Local time, honestly.** Four of the six shapes carry no timezone, so
  their instant is a property of the machine; `TZ` is honoured and the
  corpus pins a zone with daylight saving, because no other kind can
  catch a wrong conversion. At a transition the offset in force before
  it wins, at both edges.
- **`--tz <zone>`**, naming the zone that dates without one resolve in.
  A timestamp read on a laptop in Chicago and on a server in UTC are
  different instants, and for the reviews this is built for that
  difference is the finding rather than a detail. It applies to
  `--after` and `--before` as well, so where on the command line it
  appears cannot change an answer.
- **`--after` / `--before` / `--sort`**, which spend the instant
  extraction already resolved, and read their own boundaries with the
  same parser they read documents with.
- **`--iso`**, **`--dedupe`**, **`--values`**, **`--year`**, `--stdin`,
  `--hidden`, `--no-ignore`. Exit codes follow grep: 0 found, 1 none,
  2 malformed.
- **An MCP server** (`dates-le mcp`) offering `extract_dates`, shared
  byte-for-byte with the extension's server and held there by the same
  corpus, and `dates_le_scan` for files and directories.

### Notes

Two findings from the port, neither visible to a passing test suite.

**Positions were quadratic on a document with one line.** Resolving a
column counts UTF-16 units, and counting them from the start of the line
is fine until the file is one line long: a log with 200,000 timestamps
on it did not finish. Offsets now resolve together in a single ordered
pass. Ninety unit tests were green while the binary hung.

**Masking an XML comment cannot preserve both lengths.** Keeping the
byte length is mandatory — a two-byte `é` replaced by one space slides
every offset after it, far enough to slice mid-character and abort — but
padding to the byte length changes the UTF-16 length, and with it every
column after the comment on that line. Positions are therefore located
against the original document rather than the mask. The corpus carries
an accented inline comment with a date after it on the same line, since
a shift before a line start cancels out in the column and would have
proved nothing.

### Fixed

- **A leading byte-order mark is no longer part of the document.** Three
  invisible bytes, added by Notepad, Excel and a PowerShell redirect, and
  stripped by VS Code before the extension ever sees a file — so the two
  frontends read the same file differently. It shifted every column on
  line one, and before a `{` it made a structured parser reject the whole
  document, which is indistinguishable from a file with no dates in it.

- **A file that cannot be read no longer fails the run.** Every
  repository has a PNG, a zip and something the runner lacks permission
  for. Exiting 2 on those made the tool unusable in CI, which is the one
  place it is most worth running. Such a file is now named on stderr and
  carried in the report with a `skipped` diagnostic, and the exit code
  reflects what was found. `--strict` restores the old behaviour for a
  pipeline that wants zero tolerance.

- **A file that is not text is named rather than dropped.** It used to
  vanish from the report entirely, which reads to whoever ran it as
  "that file was clean".
