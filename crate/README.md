<p align="center">
  <img src="https://raw.githubusercontent.com/nolindnaidoo/dates-le/main/src/assets/images/icon.png" alt="dates-le logo" width="96" height="96"/>
</p>

<h1 align="center">dates-le</h1>

<p align="center">
  <b>Find every date and timestamp in a codebase, and the instant each one resolves to</b><br/>
  <i>ISO-8601, RFC 2822, Unix epoch seconds and milliseconds, and the written forms in between</i>
</p>

<p align="center">
  <a href="https://crates.io/crates/dates-le">
    <img src="https://img.shields.io/crates/v/dates-le.svg" alt="dates-le on crates.io" />
  </a>
  <a href="https://crates.io/crates/dates-le">
    <img src="https://img.shields.io/crates/d/dates-le.svg" alt="crates.io downloads" />
  </a>
  <a href="https://github.com/nolindnaidoo/dates-le/actions/workflows/ci-crate.yml">
    <img src="https://github.com/nolindnaidoo/dates-le/actions/workflows/ci-crate.yml/badge.svg" alt="Build Status" />
  </a>
  <img src="https://img.shields.io/badge/rustc-1.88+-93450a.svg" alt="MSRV: Rust 1.88+" />
  <a href="https://github.com/nolindnaidoo/dates-le/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
  <a href="https://letools.dev/tools/dates-le">
    <img src="https://img.shields.io/badge/web-letools.dev-00A0FF.svg" alt="letools.dev" />
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/nolindnaidoo/dates-le/main/assets/demo.gif" alt="dates-le demo — the real binary, recorded by assets/demo.tape" width="100%"/>
</p>

> **Useful?** A star is how other developers find it —
> [★ GitHub](https://github.com/nolindnaidoo/dates-le) ·
> [letools.dev/tools/dates-le](https://letools.dev/tools/dates-le)

A date is the one literal that looks correct in review and is wrong in
production. `2024-01-15` in a config, `1705276800` in a fixture and
`Mon, 15 Jan 2024 10:30:45 GMT` in a test are the same instant written
three ways, and no reviewer holds all three in their head. "What dates
are hardcoded in here, and which have already passed" is not a question
grep can answer, because grep matches text and the question is about
time.

## Install

| Route | Command | Worth knowing |
|---|---|---|
| **cargo** | `cargo install dates-le` | Any platform, needs **Rust 1.88+**. |
| **From source** | `git clone https://github.com/nolindnaidoo/dates-le`<br>`cd dates-le/crate && cargo build --release` | The same build CI runs. |

No runtime, no network, nothing written.

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

## Options

```
--after <date>       keep dates at or after this instant
--before <date>      keep dates strictly before this instant
--sort               order by instant rather than by position
--dedupe             collapse repeated dates to their first occurrence
--iso                add each instant as a UTC ISO 8601 string
--tz <zone>          resolve dates that carry no timezone in this IANA
                     zone, e.g. UTC or America/New_York, instead of
                     this machine's
--format <format>    force a format instead of inferring it from the
                     file name; a name nothing recognises falls back to
                     the shared patterns rather than failing
--year <year>        the year a syslog line is assumed to be in, since
                     the line does not carry one. Defaults to this one,
                     which makes that answer move
--values             print only the dates, one per line, for piping
--strict             exit 2 if any file could not be read, rather than
                     reporting it and carrying on
--stdin              read one document from stdin
--hidden             walk hidden files and directories too
--no-ignore          walk files that .gitignore excludes
```

`--after` and `--before` accept anything this tool can read, so
`--after 2024-01-15` and `--after 'March 5, 2024'` both work.

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

## Documentation

| What | Where |
|---|---|
| What this tool is allowed to say — scope, output contract, refusals, non-goals | [SPEC.md](https://github.com/nolindnaidoo/dates-le/blob/main/crate/SPEC.md) |
| How the code is written and held together — architecture, invariants, the gates | [AGENTS.md](https://github.com/nolindnaidoo/dates-le/blob/main/crate/AGENTS.md) |
| The VS Code extension this shares its extraction with | [README.md](https://github.com/nolindnaidoo/dates-le/blob/main/README.md) |
| What changed | [CHANGELOG.md](https://github.com/nolindnaidoo/dates-le/blob/main/crate/CHANGELOG.md) |
| The tool's page, and the other fifteen | [letools.dev/tools/dates-le](https://letools.dev/tools/dates-le) |

## More from the LE family

Sixteen single-purpose tools for the work in front of every model. Each ships
a Rust CLI and an MCP server. One page: **[letools.dev](https://letools.dev)**

**Get it out**

- **[String-LE](https://letools.dev/tools/string-le)** — Extract every string in a codebase, with its position, so a person can read them
- **[Numbers-LE](https://letools.dev/tools/numbers-le)** — Extract every hardcoded number in a codebase, so a person can check them
- **[Units-LE](https://letools.dev/tools/units-le)** — Extract every quantity with its unit, normalized, and refuse the ambiguous ones by name
- **[Dates-LE](https://letools.dev/tools/dates-le)** — Extract every date and timestamp, and the exact instant each one resolves to
- **[IDs-LE](https://letools.dev/tools/ids-le)** — Extract every UUID, ULID, NanoID, ObjectId and Snowflake, and decode the time inside
- **[IPs-LE](https://letools.dev/tools/ips-le)** — Extract every IP address, CIDR block and MAC, normalized and classified by scope
- **[URLs-LE](https://letools.dev/tools/urls-le)** — Extract every URL in a codebase, with its protocol and exact position
- **[Paths-LE](https://letools.dev/tools/paths-le)** — Extract every file path in a codebase, and say whether it still points at anything
- **[Colors-LE](https://letools.dev/tools/colors-le)** — Extract every color in a codebase, and say which ones are not in your palette

**Check it**

- **[Regex-LE](https://letools.dev/tools/regex-le)** — Find every regex in a codebase, and report which can be driven into catastrophic backtracking
- **[Versions-LE](https://letools.dev/tools/versions-le)** — Find where one dependency is constrained differently across a repository's manifests
- **[i18n-LE](https://letools.dev/tools/i18n-le)** — Identify the i18n library a project uses, then audit its catalogs by that library's rules
- **[Scrape-LE](https://letools.dev/tools/scrape-le)** — Check whether a page is scrapeable before the scraper is written, and say when it cannot tell

**Guard it**

- **[Secrets-LE](https://letools.dev/tools/secrets-le)** — Find hardcoded credentials in a codebase, and never print one into the report
- **[EnvSync-LE](https://letools.dev/tools/envsync-le)** — Compare the dotenv files in a tree, and say which keys are missing from which
- **[Unicode-LE](https://letools.dev/tools/unicode-le)** — Find the Unicode that hides meaning — bidi controls, invisibles, homoglyphs, mixed scripts

Each stands on its own: no shared crate, no published core. Where two of them
agree, it is because the same answer was right twice.

**Contact** — [nolindnaidoo.com](https://nolindnaidoo.com) · [GitHub](https://github.com/nolindnaidoo) · [LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

## Also by nolindnaidoo

**Rust** — pixelcoords and pixelactions are one loop: pixelcoords answers
*where*, pixelactions *acts* there. Their own tools, their own voice — not
part of the LE family.

- **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** — Freeze your screen, mark regions, get pixel-exact coordinates and crops
  [pixelcoords.dev](https://pixelcoords.dev) · [crates.io](https://crates.io/crates/pixelcoords) · [docs.rs](https://docs.rs/pixelcoords)
- **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** — Consume human-verified coordinates, perform the interaction, confirm it landed
  [pixelactions.dev](https://pixelactions.dev) · [crates.io](https://crates.io/crates/pixelactions) · [docs.rs](https://docs.rs/pixelactions)

## License

MIT — see [LICENSE](https://github.com/nolindnaidoo/dates-le/blob/main/LICENSE).
