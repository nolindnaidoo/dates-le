# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Every text file is read.** The walk skipped any file whose name
  resolved to none of nine formats, so a repository of Python, Go, Rust,
  TOML and Markdown was walked and almost entirely unread — and the
  reader saw a clean report rather than a skipped one. A format only ever
  *adds* patterns to the shared ones, so the shared scan is the correct
  reading of a document nobody named: `resolve_format` now yields
  `unknown` instead of nothing, `extract` has a fallback arm, and
  `has_a_format()` is gone from `walk.rs`. `toml`, `ini`, `cfg`, `conf`,
  `properties`, `markdown` and `md` are named formats rather than
  unknowns; `toml` and `markdown` join the tool schema's enum.
- **Four notations `Date.parse` refuses**, in a new `extract/extended.rs`
  that sits *above* the V8 parser and leaves the 140-case oracle
  untouched: ISO 8601 week dates (`2024-W03`, `2024-W03-1`), ordinal
  dates (`2024-015`), the basic format (`20240115`, `20240115T103045Z`),
  and the abbreviations `CEST CET BST JST AEST IST` as fixed offsets.
  Each is normalised into a string V8 does read, so nothing here computes
  an instant and both frontends diverge identically. `week`, `ordinal`
  and `basic` are new `format` values. SPEC.md lists all of it under
  Deliberate divergences, `IST` named as the guess it is.
- **Unix epochs in microseconds and nanoseconds** — 16 and 19 digits,
  same plausible-range floor, converted by taking the leading 13
  *characters* rather than by dividing, because 19 digits do not fit a
  double and a division would round in JavaScript and not in Rust.
- Corpus documents `settings.py`, `handler.go`, `release-notes.md`,
  `pyproject.toml` and `notations.txt`, and MCP cases for each.

### Changed

- **`--format` no longer refuses a name it does not recognise**, and
  `--stdin` no longer requires one: both fall back to the shared
  patterns. The same on the MCP surface — `extract_dates` with no
  `format` and no `filename`, and `dates_le_scan` with an unrecognised
  `format`, were refusals and are answers now, carrying
  `fileType: "unknown"`. The two corpus cases that pinned those refusals
  were updated deliberately.
- **A binary file is skipped silently rather than reported.** Widening
  the walk means a PNG now reaches the reader; a NUL byte in the first
  8KB (ripgrep's heuristic) means the file was never a text candidate, so
  it produces no report line and does not affect `--strict` — which
  would otherwise exit 2 on any repository containing an image. They are
  counted in the stderr summary (`, 14 binary files skipped`) so the
  coverage is still stated. A file that *is* text and cannot be read
  keeps its named `skipped` diagnostic and still fails `--strict`.
- **Every epoch wider than ten digits is held to a ceiling as well as a
  floor** — on or after 2001-09-09, before 2100-01-01, one window shared
  by the 13-, 16- and 19-digit forms. At ten digits the digit count is a
  real ceiling (2286); at every wider width the range is the same
  2001–2286, so every numeral of that width landed inside it and the
  floor excluded nothing. The corpus had a 13-digit `request_id` pinned
  as a date in 2282; a card number read as 2113 and
  `Number.MAX_SAFE_INTEGER` as 2255. All three are refused now and
  pinned as non-dates.

  Ten digits keeps the digit count as its only ceiling: there the count
  genuinely bounds the value, and a seconds epoch is the form people
  write by hand for a future cutoff. Its phone-number false positive
  stays pinned, as does `1111111111111111111` — 2005-03-18, and
  indistinguishable from a real timestamp by any rule that does not look
  at the characters.

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
