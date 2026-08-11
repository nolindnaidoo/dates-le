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
