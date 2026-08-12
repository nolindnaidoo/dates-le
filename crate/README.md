# dates-le

Find every date and timestamp in a codebase, and the instant each one
resolves to.

A date is the one literal that looks correct in review and is wrong in
production. `2024-01-15` in a config, `1705276800` in a fixture and
`Mon, 15 Jan 2024 10:30:45 GMT` in a test are the same instant written
three ways, and no reviewer holds all three in their head. "What dates
are hardcoded in here, and which have already passed" is not a question
grep can answer, because grep matches text and the question is about
time.

```bash
cargo install dates-le
```

```bash
dates-le src/                       # every date, as JSON, one line per file
dates-le --before 2026-01-01 .      # everything already in the past
dates-le --sort --iso config/       # ordered by instant, in readable form
dates-le --values . | sort -u       # just the strings, for piping
```

Exit codes follow grep: `0` dates found, `1` none found, `2` a malformed
question. Finding none is an answer, not an error.

A file that is not text is not read and not reported — it was never a
candidate — and is counted in the stderr summary instead. A file that
*is* text and cannot be opened is named on stderr and carried in the
report rather than failing the run. `--strict` turns those back into a
failure.

## What it reads

**Every text file.** JSON, YAML, CSV, XML, log and plaintext,
JavaScript, TypeScript, HTML, TOML and Markdown are names it knows;
anything else — Python, Go, Rust, shell, SQL — is scanned with the nine
patterns every format shares. There is no parsing; the format only
decides which extra patterns join the nine, so a malformed document
still yields its dates.

| Notation | Example |
|---|---|
| `iso` | `2024-01-15T10:30:45.123Z` |
| `rfc2822` | `Mon, 15 Jan 2024 10:30:45 GMT` |
| `unix` | `1705314645`, `1705314645123`, and microseconds and nanoseconds |
| `utc` | `Mon Jan 15 2024 10:30:45 GMT+0000` |
| `local` | `1/15/2024 10:30:45` |
| `simple` | `2024-01-15` |
| `week` | `2024-W03`, `2024-W03-1` |
| `ordinal` | `2024-015` |
| `basic` | `20240115`, `20240115T103045Z` |
| `custom` | syslog, Apache, `datetime=`, `new Date('March 5, 2024')` |

XML comments are skipped. Log files add syslog and Apache access lines.
JavaScript and TypeScript add date-constructor arguments, which is how a
string like `March 5, 2024` — recognisable only by where it sits — is
found at all.

## The instant is the point

Every value carries the epoch-millisecond instant it resolves to, and a
value whose instant cannot be resolved is not reported. That gate is
what keeps a phone number out of the output.

Resolution matches `Date.parse` in V8 exactly, including the legacy
parser no standard describes: garbage words are legal before the first
number and fatal after it, weekday names are read and discarded, months
match on three letters, `EST` is a fixed −5 rather than a zone, and a
two-digit year is 1900s from 50. Those rules were established by asking
V8 and are pinned in `fixtures/date-parse.json`, which `cargo test`
replays.

Four shapes V8 refuses are read anyway — week dates, ordinal dates, the
basic format, and `CEST CET BST JST AEST IST` — by normalising each into
a string V8 does read. Every one is listed as a deliberate divergence in
`SPEC.md`, and the extension diverges identically.

**A date with no timezone resolves against this machine's.** Several of
the shapes carry no zone, so their instant genuinely differs by machine
— exactly as it does for the code being audited. `--tz UTC` names one
instead, and applies to `--after` and `--before` too, so where the
command was typed cannot change the answer. At a daylight-saving
transition the offset in force *before* the transition wins, for both
the hour that does not exist and the hour that happens twice.

## As an MCP server

```bash
dates-le mcp
```

Two tools. `extract_dates` takes document text and is byte-identical to
the one the VS Code extension's server offers — the same corpus runs
against both. `dates_le_scan` reads files and directories.

## The other half

This is the CLI and MCP half of
[dates-le](https://github.com/nolindnaidoo/dates-le), a VS Code
extension. Extraction is shared and held identical by
`fixtures/`; the extension's converting, filtering and validating are
interactive and stay in the editor. `SPEC.md` is the behavioural
contract, divergences included.

MIT.
