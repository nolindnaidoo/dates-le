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

Eleven names resolve, and everything else resolves to `unknown`:

| Name | Extractor | Adds |
|---|---|---|
| `json`, `csv`, `yaml`, `toml`, `markdown` | shared core | — |
| `xml` | shared core | closed comments masked before scanning |
| `log`, `plaintext` | shared core | log timestamps, syslog, Apache |
| `javascript`, `typescript` | shared core | date-constructor arguments |
| `html` | shared core | `datetime=`, date `<meta>`, JSON-LD |
| anything else — `unknown` | shared core | — |

There is no parsing. Every extractor is the same regex scan over raw
text; the format only decides which extra patterns join it. That is why
a `.json` file and a `.csv` file are read identically, and why a
malformed document still yields its dates instead of a parse error.

**A comment nobody closed is not a comment.** Masking needs the `-->`,
so `<a>1</a><!-- 2024-01-15` yields that date rather than losing the rest
of the document — the same rule the extension's masking regex has always
had. The opening `<!--` cannot close itself either: `<!-->` is not an
empty comment.

**Whitespace is JavaScript's, not Rust's.** The two sets differ by
exactly two characters — U+FEFF, which only JavaScript counts, and
U+0085, which only Unicode's `White_Space` does. It matters wherever a
format name is trimmed and wherever a pattern separates one token from
another, so `format: "\u{feff}json"` is `json` and
`datetime\u{feff}="March 5, 2024"` is a date. This is the same trap as
`\d` and `\b`, which are Unicode in Rust and ASCII in JavaScript and are
written out for the same reason.

**An unrecognised format is a fallback, not a refusal.** Because a
format only ever *adds* patterns to the shared ones, the shared scan is
the correct reading of a document nobody named — and refusing it was
this tool declining to open `.py`, `.go`, `.rs`, `.toml` and `.md` at
all, in a repository where Python was the largest file type. What the
fallback does **not** get is the format-specific patterns: `Jan 15
10:30:47` is a date in a log file and three words in a Python one.

The name a caller sends is still reported back as `fileType`, so
`typescript` and `plaintext` are their own keys rather than aliases of
`javascript` and `log`, and an unrecognised one comes back as `unknown`
rather than silently as something else — the two servers must not
disagree about what they just read.

## The nine shared patterns

Matched over the whole document, not per line, so a construct spanning
lines is still found.

| Format | Shape |
|---|---|
| `iso` | `2024-01-15T10:30:45`, optional `.mmm`, optional `Z` or `±HH:MM` |
| `rfc2822` | `Mon, 15 Jan 2024 10:30:45 GMT` |
| `unix` | exactly 10, 13, 16 or 19 digits, no digit either side |
| `utc` | `Mon Jan 15 2024 10:30:45 GMT+0000` |
| `local` | `1/15/2024 10:30:45` |
| `simple` | `2024-01-15` |
| `week` | `2024-W03`, `2024-W03-1` |
| `ordinal` | `2024-015` |
| `basic` | `20240115`, `20240115T103045Z` |

A Unix timestamp must also land above 1e9 seconds / 1e12 milliseconds,
so a 10-digit account number is not read as a date in 1970. Ten digits
is the pattern's own floor; the range check is what makes it a date.

**Sixteen and nineteen digits are microseconds and nanoseconds**, and
they are converted by taking the leading thirteen **characters** rather
than by dividing. Nineteen digits do not fit a double, so JavaScript
would round a division and the crate's i64 would not — the two frontends
would then agree about most nanosecond timestamps and differ in the last
millisecond of some, which is the worst kind of difference to find.

**Everything wider than ten digits is held to a ceiling as well, and
needs one because the digit count stops being one.** At ten digits the
count is a real bound: the widest value a ten-digit numeral holds is the
year 2286, so "ten digits, in range" excludes a great many numbers. At
thirteen, sixteen and nineteen the range is the *same* 2001–2286, so
every numeral of those widths lands inside it and the floor excludes
nothing at all — which is how a 13-digit request id read as 2282, a
16-digit card number as 2113 and `Number.MAX_SAFE_INTEGER` as 2255.

A ceiling can be drawn honestly at these widths because the units are
machine-stamped — `Date.now()`, `time.time_ns()`, `UnixNano()` — and
record the moment a program ran. A *future* date in a codebase is an
expiry, a cutoff or a schedule, and those are written as dates or as
seconds; nobody writes the year 2113 in milliseconds. So a 13-, 16- or
19-digit run is a date only if it lands **on or after 2001-09-09 and
before 2100-01-01** — the same 2100 boundary the bare eight-digit form's
1900–2099 window uses, so there is one notion of a plausible year here
rather than two. All three widths share that one window.

**Ten digits keeps the digit count as its only ceiling**, and that is
the reasoned exception rather than an oversight: at that width the count
genuinely bounds the value, and a seconds epoch is the one form people
write by hand for a future cutoff. The 10-digit phone number stays the
honest false positive it always was.

What the window cannot do is judge digits. `1111111111111111111` is
2005-03-18 and is still read as a date, because by instant it is
indistinguishable from one. That and the phone number are in the corpus
as the false positives they are.

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
     always −5. `CEST` and `JST` are refusals *here*; see the layer
     above this one.
   - A two-digit year is 1900s from 50, 2000s below it.
   - Parenthesised text is a comment, closed or not.
   - `1:30 PM` is 13:30; `13:30 PM` is a refusal.

Anything neither parser reads is a refusal at this layer, and a refused
value is dropped rather than emitted without an instant.

### The layer above `Date.parse`

Four things are read that V8 answers `NaN` to. Each is a **deliberate
divergence**, listed under Deliberate divergences below, and each is
implemented the same way: the value is normalised into a string V8 *does*
read and handed back to `Date.parse`. Nothing here computes an instant,
so a week date is UTC for exactly the reason `2024-01-15` is UTC, and the
178-case oracle stays untouched — this layer can only turn a refusal into
a value, never a value into a different one.

- **ISO 8601 week dates.** `2024-W03` is the Monday of ISO week 3, the
  week containing 4 January being week 1. A week the year does not have
  (`2024-W53`) is a refusal rather than the next year's first week.
- **ISO 8601 ordinal dates.** `2024-015` is the fifteenth day of 2024.
  `2023-366` is a refusal. Note that V8 *does* read `2024-001` — as
  January of the year 2024, in local time — and extraction reads it as
  day one instead, which is the one place this layer disagrees with an
  answer V8 would have given rather than filling a gap.
- **ISO 8601 basic format.** `20240115T103045Z` becomes
  `2024-01-15T10:30:45Z`, keeping every zone rule the extended form has.
  A bare `20240115` is the one shape here that cannot prove it is a date,
  so it is additionally held to a year in **1900–2099**: `12345678` is
  month 56 and `98765432` would otherwise be a September in the year
  9876.
- **Six more timezone abbreviations** — `CEST +02:00`, `CET +01:00`,
  `BST +01:00`, `JST +09:00`, `AEST +10:00`, `IST +05:30` — each
  rewritten to its numeric offset, matched as a whole word so `HISTORY`
  is not India. Fixed offsets, not zone-aware, the same rule V8 applies
  to `EST`. **`IST` is a guess**: it names India, Ireland and Israel, no
  text can say which, and India is the one taken.

### Local time is a real dependency

Several of the shapes carry no timezone, so their instant depends on
the machine's. That is not a defect to hide — it is the answer, and the
answer genuinely differs by machine, exactly as it does for the code
being audited.

`--tz` names a zone; without it the machine's is used, and `TZ` is
honoured where the operating system honours it. The corpus pins
`America/New_York` precisely because a zone with DST is the only kind
that can catch a wrong conversion — and pins it with `--tz`, because
Windows ignores `TZ` and a contract that only holds on two of three
platforms is not one.

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

**`file` uses `/` on every platform.** The report is protocol, so it has
one spelling rather than one per operating system; a Windows run
otherwise produced JSON the same consumer could not read.

Exit codes follow grep: `0` dates found, `1` none found, `2` a malformed
question. Finding none is an answer, not an error.

## Files that cannot be read

Exit 2 means the *question* was malformed — an unknown flag, an
unreadable format name, a path that does not exist. It does not mean one
file in fifty thousand was a PNG.

**A file that is not text at all is not a file that failed to be read.**
A PNG or a zip — a NUL byte in its first 8KB, ripgrep's own heuristic —
produces no report line and no diagnostic, because it was never a text
candidate: before the walk read every file it was never opened, and
reporting one would put every image in a repository into the report and
make `--strict` exit 2 on any tree containing one. They are **counted**
in the stderr summary, so the reader still knows the walk covered less
than the tree.

A file that IS text and could not be read — no permission, or bytes that
are not UTF-8 — is:

- named on stderr,
- carried in the JSON report with a `skipped` diagnostic saying why,
- and left out of the exit code.

`--strict` turns any skipped file back into exit 2, for a pipeline that
wants zero tolerance. What is never allowed is the third option: a file
that silently vanishes from the report, which reads to whoever ran it as
a file that was clean.

## The byte-order mark

A leading BOM is stripped before extraction. It is three invisible bytes
that Notepad, Excel and a PowerShell redirect all add, and that VS Code
removes before the extension sees a document — so leaving it in means
the two frontends read the same file differently. It shifts every column
on the first line, and in a structured format it can lose the document
entirely.

A BOM anywhere other than the start is a zero-width no-break space and
belongs to the text.

## Deliberate divergences

Everything here is a place the two frontends differ on purpose. Anything
else is a regression.

- **`--after` / `--before` / `--sort` / `--iso` / `--values` / `--tz`**
  are CLI only. The MCP tool is byte-identical across the two servers.
- **Syslog lines carry no year**, so the extension assumes the current
  one — extraction that depends on a clock. The crate does the same, and
  `--year` overrides it so a corpus can pin it. Without the override
  both frontends agree only within a calendar year, which is why the
  syslog fixture pins the year explicitly.
- **The walk** is the crate's alone; the extension reads one document.
- **Week dates, ordinal dates, the basic format and six timezone
  abbreviations** are read here and are `NaN` in `Date.parse`. The
  extension diverges identically — both frontends run the same layer
  above V8, and `fixtures/extraction.json` holds every case — so this is
  a divergence from V8, not between the two servers. `2024-001` is the
  sharpest of them: V8 reads it as January 2024 in local time, and this
  reads it as the first day of 2024 in UTC.
