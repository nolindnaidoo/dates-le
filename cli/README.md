# dates-le

Get every date and timestamp in a codebase into one list, with the instant
each resolves to and the file, line and column it came from: the reviewer
checking which expiry dates a repository hard-codes, the auditor lining up
log timestamps written three different ways, the migration that has to find
every date still written month-first.

```bash
npx dates-le src/
npx dates-le --iso --sort logs/ > dates.jsonl
cat CHANGELOG.md | npx dates-le --stdin --format markdown
```

The command it installs is `dates-le`, the same command line as the Rust
crate [`dates-le`](https://crates.io/crates/dates-le), and it behaves
identically: same flags, same walk, same positions, same instants, same
output, same exit codes. Install whichever toolchain you already have.

## What it reads

Every file. ISO 8601 in every form it is written (extended, basic, week and
ordinal), RFC 2822, day-first and month-first numeric dates, dates with the
month written out, log and syslog lines, Apache access logs, and the
strings inside date constructors. Unix epochs from seconds to nanoseconds
are read when `--kinds` lists `unix`. JSON, YAML, CSV, XML, log, HTML,
JavaScript and TypeScript each add what their format needs, and anything
else is read with the patterns they share. Directories are walked the way
ripgrep walks them: `.gitignore` and hidden files are respected unless you
pass `--no-ignore` or `--hidden`.

Each date carries the instant it resolves to, in milliseconds, so
`2024-01-15`, `1705276800` and `Mon, 15 Jan 2024` can be compared rather
than read. A date written without a timezone resolves in this machine's,
or in the IANA zone `--tz` names.

## Output

stdout carries one JSON report per file whenever it is piped or redirected,
and nothing when it is a terminal. stderr lists every date with its
position.

```text
$ dates-le --tz UTC --year 2024 --iso CHANGELOG.md logs
CHANGELOG.md:1:5  2024-01-15T10:30:45Z  [iso]  2024-01-15T10:30:45Z
CHANGELOG.md:1:35  March 5, 2024  [local]  2024-03-05T00:00:00Z
logs/app.log:1:1  2024-01-15 10:30:45.123  [iso]  2024-01-15T10:30:45.123Z
logs/app.log:2:1  Jan 16 08:00:00  [custom]  2024-01-16T08:00:00Z
4 dates in 2 files
```

```json
{"file":"logs/app.log","fileType":"log","dates":[{"value":"2024-01-15 10:30:45.123","format":"iso","timestamp":1705314645123,"line":1,"column":1,"iso":"2024-01-15T10:30:45.123Z"},{"value":"Jan 16 08:00:00","format":"custom","timestamp":1705392000000,"line":2,"column":1,"iso":"2024-01-16T08:00:00Z"}]}
```

Columns count UTF-16 code units, as an editor does. A syslog line carries no
year, so it is read in this one unless `--year` names another.

`--values` prints the dates alone, one per line, wherever stdout goes.

A file that is not UTF-8 text, or that cannot be opened, is named on stderr
and carried in its report as `skipped`. It does not fail the run on its
own. A binary file is not read and is counted in the summary.

## Exit codes

grep's convention:

- **0**: dates found.
- **1**: none found. That is an answer, not an error.
- **2**: the question was malformed, or `--strict` and a file could not be
  read.

## For agents

`dates-le mcp` serves the Model Context Protocol on stdio with two tools:
`extract_dates` for a document's text and `dates_le_scan` for files and
directories. Hosts that want the document tool alone can install
[`dates-le-mcp`](https://www.npmjs.com/package/dates-le-mcp).

`dates-le --help` lists every option.

MIT licensed. Part of [letools](https://letools.dev/tools/dates-le).
