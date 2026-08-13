# Instructions for AI coding assistants

Read [AGENTS.md](AGENTS.md) first — it is the engineering-standards
document for this crate and the source of truth for layout, control-flow
style, the settled decisions, testing requirements, and the definition
of done. [SPEC.md](SPEC.md) defines the product behavior. AGENTS.md wins
on any conflict. The extension at the repo root is a separate product
with its own `CLAUDE.md`.

- Before declaring any change complete, run exactly what CI runs:
  `cargo fmt --all --check`,
  `cargo clippy --all-targets -- -D warnings`,
  `cargo test --locked`, and
  `TZ=America/New_York bun ../scripts/check-extraction-parity.ts` when
  extraction changed. The crate's own tests need no `TZ` — they name
  their zone. The parity script runs against V8 and still does.
- Never add inline `#[allow(...)]` — CI fails the build on it. Fix the
  lint, or add a commented relaxation to `[lints.clippy]` in
  `Cargo.toml`. Three are there already, with their reason.
- New logic goes in `extract/` when it is pure (it must then be
  unit-tested, 75% module coverage floor), and in `walk.rs` / `scan.rs`
  only when it needs the filesystem.
- **The tests name their zone; they do not read `TZ`.** Windows ignores
  `TZ`, so a corpus that depended on it could only be checked on two of
  the three platforms this ships to. `time::with_zone` is how, and
  `--tz` is the same mechanism on the command line.
- **`fixtures/date-parse.json` is V8's answers, not ours.** It is the
  authority for `src/extract/parse.rs`. Regenerate it only with
  `TZ=America/New_York bun ../scripts/generate-date-parse-corpus.ts`,
  never by hand, and never to make a failing test pass — a disagreement
  means the parser is wrong, because the extension *is* V8.
- **Adding a case to that corpus is the point.** Removing one needs a
  reason in the CHANGELOG: every case is a rule someone relied on.
- **Two lengths matter and masking can only keep one.** XML comment
  masking preserves *byte* length, so no offset slides and nothing
  slices mid-character; it does not preserve UTF-16 length, because a
  two-byte `é` becomes two spaces. That is why positions are located
  against the **original** document and not the mask. A `debug_assert`
  guards the byte length; do not remove it.
- **Whitespace goes through `extract/js.rs`.** JavaScript's set includes
  U+FEFF and Rust's does not; Rust's includes U+0085 and JavaScript's
  does not. `js::trim` and `JS_SPACE_CLASS` define it once — a bare
  `str::trim` or `\s` anywhere in `extract/` is a bug, and was one twice.
  `parse.rs` is the exception, and only because V8's date parser has its
  own narrower rule, pinned by the oracle: there a word runs while the
  character is `A` or above, so a non-breaking space is *inside* a word.
- **Lowercase with `to_ascii_lowercase` wherever an index follows.**
  Rust's full `to_lowercase` changes the byte length of some characters
  — `İ` grows, `K` (U+212A) shrinks — so a span taken from the copy
  describes a different span of the original, and one landing
  mid-character aborts the process. V8 folds with `c | 0x20`, so ASCII
  folding is also the faithful one. `format.rs` may keep the full
  `to_lowercase` because it only ever compares.
- **Columns are UTF-16 units**, which is what an editor reports. Bytes
  are wrong for anything accented and characters are wrong for anything
  astral; `fixtures/documents/schedule.yaml` has an emoji on a line for
  exactly that reason.
- **Positions are resolved in one ordered pass**, not one lookup each.
  Counting UTF-16 units from the start of the line is quadratic when
  there is only one line, and a log file with 200,000 timestamps on it
  did not finish. Ninety unit tests were green at the time.
- **The syslog year is the one clock dependency.** A syslog line does
  not carry a year, so extraction takes one. The CLI has `--year`; the
  shared MCP tool deliberately does not, because adding an argument the
  npm server lacks would make them different tools.
- `fixtures/` is shared with the extension — changing it changes both
  frontends and needs a CHANGELOG entry. **What it holds equal is the
  shared `extract_dates` MCP tool**, which must answer identically from
  either server; a difference there is a bug. The surfaces themselves
  are IDE-first and terminal-first and are meant to differ —
  the walk, `--after`/`--before`, `--tz`, `--strict`, the exit codes and JSON Lines have no
  editor equivalent and are not drift. SPEC.md's "Deliberate
  divergences" is the bar for a new one.
- Write regression tests for every bug you fix; keep unit tests free of
  clocks, randomness, and the filesystem outside `walk`/`scan`.
- **Run the binary, not only the tests.** Every defect worth having
  found in this crate was invisible to a green suite.
