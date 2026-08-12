# dates-le (CLI) — engineering standards

This is the source of truth for how code in `crate/` is written, tested,
and reviewed. It applies to every contributor, human or AI-assisted. CI
(`.github/workflows/ci-crate.yml`) enforces the mechanical parts;
reviewers enforce the rest. [SPEC.md](SPEC.md) defines the product
behavior — the patterns, the instant, exit codes, the parity scope; this
file is how the code gets there. The extension at the repo root is a
separate TypeScript product with its own `AGENTS.md`.

## What this project is

The command-line and MCP frontend of Dates-LE: find every date and
timestamp in a codebase, and the instant each one resolves to. Nothing
is rewritten or judged. One product, two frontends, one repository: the
corpus (`fixtures/`) is shared with the VS Code extension, and CI fails
when either side drifts from it.

**The instant is the product.** Finding date-shaped text is easy and
nearly useless — `2024-01-15`, `1705276800` and `Mon, 15 Jan 2024` are
the same moment and no reviewer sees that by reading. Resolving each one
to a number is what turns a list of strings into something that can be
sorted, filtered and compared. Every decision below follows from that.

**Status: released.** Both surfaces and the test layers below
are green. Releases go out through `release-crate.yml`, which is
dispatch-only and refuses a version that crates.io already carries, has
no changelog entry, would ship a tarball missing its own corpus, or
whose corpus the extension no longer reproduces.

## Layout

```
crate/src/
├── extract/     pure: the patterns, the two date parsers, the calendar
│                arithmetic, positions. No filesystem, pub(crate).
│   ├── heuristics.rs  the patterns and containment dedupe
│   ├── parse.rs       Date.parse, both of V8's parsers
│   ├── extended.rs    the shapes V8 refuses, normalised into ones it reads
│   ├── time.rs        components → instant, and local time
│   ├── position.rs    byte offset → line and UTF-16 column
│   ├── format.rs      a caller's format name → a language id
│   └── mod.rs         the entry point, and XML comment masking
├── walk.rs      ignore-aware tree walking
├── scan.rs      one file end to end — the only path either surface calls
├── cli.rs       the terminal surface
└── mcp/         the agent surface
```

The dependency direction is one-way: `extract/` knows nothing about
files, flags or JSON-RPC. A `std::fs` call inside `extract/` is a
review failure.

## The settled decisions

These are closed. Reopening one needs a reason in the pull request, not
a preference.

### `Date.parse` is written out, not delegated

The extension resolves every instant with `Date.parse` in V8. A value
whose instant cannot be resolved is **dropped**, so a parser that is
merely close does not produce slightly different numbers — it produces a
different set of findings. No general date library is bug-compatible
with V8's legacy parser, so this crate implements it directly.

`fixtures/date-parse.json` holds V8's own answers to 140 cases and is
the authority. Regenerate it only with the generator, under `TZ` — the
generator runs in V8, which does honour it — never by hand. **A disagreement means the parser is wrong**, because the
extension is V8.

### Every divergence from V8 lives above `parse.rs`, never in it

Week dates, ordinal dates, the basic format and the six timezone
abbreviations V8 lacks are all read here and are all `NaN` in
`Date.parse`. They live in `extended.rs`, which tries `date_parse`
**first** and only then its own rules — so the oracle stays the authority
and this layer can turn a refusal into a value but never a value into a
different one.

Nothing in `extended.rs` computes an instant. Each shape is normalised
into a string V8 *does* read and handed back, which is what keeps a week
date UTC for the same reason `2024-01-15` is UTC, and keeps the two
frontends identical without either owning a second calendar. A new shape
belongs there, with a case added to `fixtures/date-parse.json` recording
V8's actual answer and a line in SPEC.md's divergences.

### A format nobody recognises is read, not refused

`patterns_for` only ever *extends* the shared list, so the shared scan is
the correct reading of a document nobody named — and refusing it meant
the walk skipped Python, Go, Rust, TOML and Markdown entirely, reporting
a clean tree rather than an unread one. `resolve_format` yields
`FALLBACK_FORMAT` and `walk.rs` filters nothing.

What the fallback must **not** get is the format-specific patterns:
`Jan 15 10:30:47` is a date in a log file and three words in a Python
one. There is a test for exactly that.

### Binary is not the same as unreadable

Widening the walk means a PNG reaches `scan_file`. It returns `None` for
one — a NUL byte in the first 8KB, ripgrep's heuristic — so no report
line is produced and `--strict` is unaffected; otherwise a repository
with sixteen images in it exits 2 under `--strict`, which makes the flag
useless. They are counted in the stderr summary instead. A file that *is*
text and could not be read keeps its named `skipped` diagnostic and keeps
failing `--strict`.

### Local time is a real dependency, and is not hidden

Several of the shapes carry no timezone. Their instant is a property of
the machine, and that is the honest answer rather than a defect to
paper over — it is equally true of the code being read.

`--tz` names a zone and `TZ` is honoured where the operating system
honours it, which is not everywhere: Windows ignores it. The corpus
therefore pins `America/New_York` with `--tz` and the unit tests name it
directly, so the contract holds on all three platforms. A zone with
daylight saving is the only kind that can catch a wrong conversion.

At a transition the offset in force **before** it wins, at both edges.
One rule, checked against V8 at both.

### The syslog year is the one clock dependency

A syslog line carries no year, so extraction takes one. `--year` pins it
for reproducibility. The shared MCP tool has no such argument on
purpose: adding one the npm server lacks would make them different
tools rather than the same tool twice.

### Two lengths, and masking can only keep one

XML comment masking preserves **byte** length, so no offset slides and
nothing can slice mid-character. It cannot also preserve UTF-16 length,
because a two-byte `é` becomes two spaces. Positions are therefore
located against the **original** document, not the mask. A
`debug_assert` guards the byte length in both directions.

### Columns are UTF-16 units

What an editor reports, and therefore what the extension produces.
Bytes are wrong for anything accented, characters for anything astral.

### Positions resolve in one ordered pass

Counting UTF-16 units from the start of a line is quadratic when the
document has one line. `locate_all` walks the document once, which is
why candidates must stay sorted by start offset.

### The patterns are ASCII on purpose

JavaScript's `\d` is `[0-9]` and Rust's is every Unicode decimal digit;
`\b` splits the same way. Both are written out explicitly. Left alone
they would find dates the extension cannot see, and miss ones it can.

### Extraction only

`analyze`, `convert`, `filter` and `validate` are interactive
quick-picks and stay in the editor — which is also what the extension's
own MCP server says by offering extraction alone. `--after`/`--before`
and `--sort` are the two exceptions, and only because extraction already
computes the instant they spend.

## Control flow and style

- **Refuse rather than guess** about a *value*: a string whose instant
  cannot be resolved is dropped rather than emitted without one. That is
  not the same as refusing a *format* — every format runs the same
  shared patterns, so an unrecognised one is read with them and reported
  as `unknown`, and the value gate is what keeps the answer honest.
- **Early returns over nesting.** No `else` after a `return`.
- `expect` only where the invariant is local and stated in the message.
  No `unwrap` in non-test code.
- Comments explain *why*. A comment restating the line below it is
  noise; a comment naming the V8 rule a branch implements is the point.
- Names are words, not abbreviations: `candidate`, `notation`,
  `offset_minutes`.

## Testing

Four layers, each answering something the others cannot.

1. **Unit tests**, beside the code, pure. 90% line coverage per module
   in `extract/`, enforced in CI. No clocks, no randomness, no
   filesystem.
2. **The V8 oracle** (`fixtures/date-parse.json`), replayed by
   `parse.rs`. This is the crate's hardest contract.
3. **The shared corpus** (`fixtures/extraction.json`,
   `fixtures/mcp-extract-dates.json`), run by `tests/corpus.rs` **through
   the packaged binary** and by `scripts/check-extraction-parity.ts`
   through the extension. Through the binary on purpose: the library has
   been right while the binary was wrong.
4. **Scenarios** (`tests/scenarios.rs`), gated behind
   `DATES_LE_SCENARIOS=1`, for documents too big for the ordinary suite.
   Every case there is a real failure a green suite let through.

Every bug fix ships with the test that would have caught it.

## The definition of done

```bash
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
TZ=America/New_York bun ../scripts/check-extraction-parity.ts   # if extraction changed
```

All four, plus: **run the binary over a real repository.** Every defect
worth having found in this crate — the aborted process in a sibling, the
quadratic position lookup here — was invisible to a green suite.
