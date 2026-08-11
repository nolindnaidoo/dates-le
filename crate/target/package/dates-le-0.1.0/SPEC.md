# dates-le — behavioural specification

The CLI and MCP server in `crate/`. The VS Code extension at the repo
root is the reference implementation; `fixtures/` is the contract
between them, and CI fails when they disagree.

## What this is

Find every date and timestamp in a codebase and put them somewhere a
person can read them, with the instant each one actually resolves to.

The reason that is worth a tool: a date is the one literal that looks
correct in review and is wrong in production. `2024-01-15` in a config,
`1705276800` in a fixture and `Mon, 15 Jan 2024 10:30:45 GMT` in a test
are the same instant written three ways, and no reviewer holds all three
in their head. An auditor asking "what dates are hardcoded in here, and
which have already passed" is asking a question grep cannot answer,
because grep matches text and the question is about time.

## What is ported, and what is not

Extraction only — which is also what the extension's own MCP server
offers. `analyze`, `convert`, `filter` and `validate` are interactive
quick-picks that need a cursor, a selection and a person choosing from a
list; they stay in the editor.

Two of them have a non-interactive shadow here, and only because the
extraction already computes what they need: `--after` / `--before` is
filtering by instant, and `--sort` is ordering by it. Neither adds a
capability; both spend the timestamp that extraction already resolved.

## Formats

Nine names resolve, to seven extractors:

| Name | Extractor | Adds |
|---|---|---|
| `json`, `csv`, `yaml` | shared core | — |
| `xml` | shared core | comments masked before scanning |
| `log`, `plaintext` | shared core | log timestamps, syslog, Apache |
| `javascript`, `typescript` | shared core | date-constructor arguments |
| `html` | shared core | `datetime=`, date `<meta>`, JSON-LD |

There is no parsing. Every extractor is the same regex scan over raw
text; the format only decides which extra patterns join it. That is why
a `.json` file and a `.csv` file are read identically, and why a
malformed document still yields its dates instead of a parse error.

**An unrecognised format is a refusal, not a fallback.** The name a
caller sends is reported back as `fileType`, so `typescript` and
`plaintext` are their own keys rather than aliases of `javascript` and
`log` — the two servers must not disagree about what they just read.

## The six shared patterns

Matched over the whole document, not per line, so a construct spanning
lines is still found.

| Format | Shape |
|---|---|
| `iso` | `2024-01-15T10:30:45`, optional `.mmm`, optional `Z` or `±HH:MM` |
| `rfc2822` | `Mon, 15 Jan 2024 10:30:45 GMT` |
| `unix` | exactly 10 or 13 digits, no digit either side |
| `utc` | `Mon Jan 15 2024 10:30:45 GMT+0000` |
| `local` | `1/15/2024 10:30:45` |
| `simple` | `2024-01-15` |

A Unix timestamp must also land above 1e9 seconds / 1e12 milliseconds,
so a 10-digit account number is not read as a date in 1970. Ten digits
is the pattern's own floor; the range check is what makes it a date.

### Overlap

`2024-01-15T10:30:45Z` contains `2024-01-15`. Both patterns match; only
the longer one survives. Containment is by byte range — a candidate
whose range lies inside a kept candidate's range is dropped — so the ISO
value wins over the bare date inside it, while the same text appearing
again elsewhere on the line is a separate occurrence and survives. At
identical ranges the earlier pattern wins, which is how a base
classification beats a format-specific `custom` wrapper.

## The instant

Every value carries the epoch-millisecond instant it resolves to, and a
value whose instant cannot be resolved is **not emitted at all**. That
is the gate that keeps a phone number out of the output.

Resolution matches `Date.parse` in V8, because the extension is
`Date.parse` in V8 and a date that resolves in one frontend and not the
other is the same defect as a missing date. This crate implements it
directly rather than reaching for a general date library, because no
general library is bug-compatible with V8's legacy parser and this is
one of the places where being right matters more than being clean.

Two parsers, in order:

1. **The Date Time String Format**, ECMA-262 §21.4.1.32 — the `YYYY-MM-DD`
   and `YYYY-MM-DDTHH:mm:ss.sssZ` grammar. Month must be `01`–`12` and
   day `01`–`31`; beyond that the arithmetic rolls over, so
   `2024-02-30` is 1 March and `2023-02-29` is 1 March 2023. A
   date-only form is **UTC**; a date-time form with no offset is
   **local**.
2. **V8's legacy parser**, for everything else. Its rules are not in any
   standard, so they were established by probing V8 directly and are
   pinned in `fixtures/date-parse.json`:
   - Words that are not keywords are skipped **before** the first number
     and are fatal after it — `Foo Jan 15 2024` parses, `Jan 15 2024 Foo`
     does not.
   - Weekday names are read and discarded, so a wrong weekday is not an
     error and `Xyz, 15 Jan 2024 10:30:45 GMT` parses.
   - A month is matched on its first three letters.
   - Named zones are the fixed offsets `GMT`/`UT`/`UTC`/`Z` and the eight
     US abbreviations. They are **fixed**, not zone-aware: `EST` is
     always −5. `CEST` and `JST` are not recognised and are refusals.
   - A two-digit year is 1900s from 50, 2000s below it.
   - Parenthesised text is a comment, closed or not.
   - `1:30 PM` is 13:30; `13:30 PM` is a refusal.

Anything neither parser reads is a refusal, and a refused value is
dropped rather than emitted without an instant.

### Local time is a real dependency

Four of the six shapes carry no timezone, so their instant depends on
the machine's. That is not a defect to hide — it is the answer, and the
answer genuinely differs by machine, exactly as it does for the code
being audited.

`TZ` is honoured. Set it to get reproducible output; the corpus pins
`America/New_York` precisely because a zone with DST is the only kind
that can catch a wrong conversion.

At a DST transition the offset in force **before** the transition wins,
for both the hour that does not exist and the hour that happens twice.
One rule, both edges, checked against V8 at both.

## Output

stdout is protocol: one JSON object per line, one line per file. stderr
is for the person, and is a projection of the same reports rather than
parallel prose.

```json
{"file":"app.log","fileType":"log","dates":[
  {"value":"2024-01-15T10:30:45Z","format":"iso","timestamp":1705314645000,"line":3,"column":12}
]}
```

`timezone` exists in the extension's value shape and is never populated
by extraction. It is omitted here rather than emitted as `null`, which
is what the extension's own JSON does.

Exit codes follow grep: `0` dates found, `1` none found, `2` a malformed
question. Finding none is an answer, not an error.

## Deliberate divergences

Everything here is a place the two frontends differ on purpose. Anything
else is a regression.

- **`--after` / `--before` / `--sort` / `--iso` / `--values`** are CLI
  only. The MCP tool is byte-identical across the two servers.
- **Syslog lines carry no year**, so the extension assumes the current
  one — extraction that depends on a clock. The crate does the same, and
  `--year` overrides it so a corpus can pin it. Without the override
  both frontends agree only within a calendar year, which is why the
  syslog fixture pins the year explicitly.
- **The walk** is the crate's alone; the extension reads one document.
  Files whose name resolves to no format are skipped rather than read
  and refused.
