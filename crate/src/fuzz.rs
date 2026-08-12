//! A standing net over the pure layer.
//!
//! `parse.rs` is a hand-written reimplementation of both of V8's date
//! parsers, driven by a 154-case oracle. That is exactly the shape where
//! a case nobody wrote down panics or spins — the oracle proves the
//! answers it contains and says nothing at all about the ones it does
//! not.
//!
//! **Not proof, and not meant to be.** It is time-boxed and
//! deterministic: a fixed seed, printed, so a failure replays exactly,
//! and a wall-clock budget so it costs the same on every run. Sixty
//! seconds a target in CI, which is a net rather than convergence.
//!
//! Three targets, each a layer the one below cannot reach:
//!
//! - `date_parse`, the two V8 parsers,
//! - `extended::instant`, the layer above them that normalises the
//!   shapes V8 refuses,
//! - `extract`, the whole pure scan — the patterns, the containment
//!   dedupe, XML masking and the position pass, which is where a byte
//!   offset can slice through the middle of a character.
//!
//! Seeded from `fixtures/date-parse.json` and the corpus documents,
//! because a mutation of something that nearly parses reaches far more
//! of the parser than a random string does.
//!
//! Gated behind `DATES_LE_FUZZ=1`, like `tests/scenarios.rs`: it is a
//! budget of seconds rather than a set of cases, and it belongs in a job
//! of its own rather than in every `cargo test`.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::time::{Duration, Instant};

use crate::extract::{extended, parse};

/// Long enough that no input this generates should come near it, short
/// enough that a spin is reported as one rather than as the job being
/// cancelled. Every one of these calls is pure and bounded by its input.
const PER_INPUT_LIMIT: Duration = Duration::from_secs(2);

/// Inputs are capped so a length that grew by mutation cannot turn a
/// slow function into an apparent hang. Nothing this parser reads is
/// longer than a line.
const MAX_LENGTH: usize = 4096;

fn enabled() -> bool {
    std::env::var("DATES_LE_FUZZ").as_deref() == Ok("1")
}

/// The budget, in seconds per target. CI passes sixty; a smaller number
/// is how a person reproduces a failure quickly.
fn budget() -> Duration {
    let seconds = std::env::var("DATES_LE_FUZZ_SECONDS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(60);
    Duration::from_secs(seconds)
}

fn seed() -> u64 {
    std::env::var("DATES_LE_FUZZ_SEED")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0x2024_0115)
}

/// A deterministic generator. Not cryptography and not statistics — the
/// requirement is that a printed seed replays a run exactly.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    fn below(&mut self, limit: usize) -> usize {
        if limit == 0 {
            return 0;
        }
        (self.next() % limit as u64) as usize
    }

    fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len())]
    }
}

/// Characters chosen to reach the branches that split this parser: every
/// separator its grammars use, the multi-byte characters that a byte
/// offset can slice through, and the invisible ones a real file carries.
/// `\u{130}` and `\u{212a}` are there for a reason of their own: their
/// lowercase forms are a different *length*, which is the shape that
/// aborted a sibling crate when a span taken from a lowercased copy was
/// applied to the original.
const ALPHABET: [char; 42] = [
    '0', '1', '5', '9', '-', '+', ':', '.', ',', '/', 'T', 'Z', 'W', 'w', 'G', 'M', 'a', 'p', 'm',
    'e', '(', ')', '[', ']', '<', '>', '"', '\'', '!', ' ', '\t', '\r', '\n', '\0', '\u{a0}',
    '\u{feff}', 'é', '—', '🗓', '٢', '\u{130}', '\u{212a}',
];

/// The strings a run starts from: everything V8 was asked about, plus
/// the shapes that live above it.
fn seeds() -> Vec<String> {
    #[derive(serde::Deserialize)]
    struct Oracle {
        cases: Vec<Case>,
    }
    #[derive(serde::Deserialize)]
    struct Case {
        input: String,
    }

    let oracle: Oracle = serde_json::from_str(include_str!("../fixtures/date-parse.json"))
        .expect("the oracle is valid JSON");
    let mut inputs: Vec<String> = oracle.cases.into_iter().map(|case| case.input).collect();
    inputs.extend(
        [
            "2024-W03-1",
            "2024-015",
            "20240115T103045Z",
            "Mon, 15 Jan 2024 10:30:45 CEST",
            "Jan 15 10:30:47",
            "15/Jan/2024:10:30:08 +0000",
            "1705314645123456789",
            "",
        ]
        .into_iter()
        .map(str::to_string),
    );
    inputs
}

/// One mutation of one input. Character-level rather than byte-level, so
/// every candidate is a valid `str` — which is the point: a slicing bug
/// is found by a multi-byte character in the wrong place, not by an
/// invalid encoding Rust would never hand the function anyway.
fn mutate(rng: &mut Rng, input: &str, pool: &[String]) -> String {
    let mut characters: Vec<char> = input.chars().collect();
    let operations = 1 + rng.below(3);

    for _ in 0..operations {
        match rng.below(7) {
            0 if !characters.is_empty() => {
                let at = rng.below(characters.len());
                characters.remove(at);
            }
            2 if !characters.is_empty() => {
                let at = rng.below(characters.len());
                characters[at] = *rng.pick(&ALPHABET);
            }
            3 if characters.len() > 1 => {
                let (from, to) = (rng.below(characters.len()), rng.below(characters.len()));
                characters.swap(from, to);
            }
            4 if !characters.is_empty() => {
                // Repeat a slice, which is how a run of digits or a
                // nested comment gets long enough to matter.
                let at = rng.below(characters.len());
                let length = 1 + rng.below(characters.len() - at);
                let slice: Vec<char> = characters[at..at + length].to_vec();
                let times = 1 + rng.below(8);
                for _ in 0..times {
                    characters.extend(slice.iter().copied());
                }
            }
            5 => {
                // Splice a second seed in, so two grammars meet.
                let other: Vec<char> = rng.pick(pool).chars().collect();
                let at = rng.below(characters.len() + 1);
                characters.splice(at..at, other);
            }
            // Insertion is also the fallback: the guarded arms above
            // decline on an empty input, and something has to happen.
            _ => {
                let at = rng.below(characters.len() + 1);
                characters.insert(at, *rng.pick(&ALPHABET));
            }
        }
        characters.truncate(MAX_LENGTH);
    }
    characters.into_iter().collect()
}

/// Run one target until the budget runs out.
///
/// Every failure names the seed, the iteration and the exact input, so
/// a red build is something to read rather than something to rerun.
fn campaign(target: &str, body: impl Fn(&str)) {
    let seed = seed();
    let budget = budget();
    let mut rng = Rng(seed | 1);
    let pool = seeds();

    // The seeds themselves first: a corpus that no longer parses is a
    // failure the mutations should never have to find.
    let inputs: Vec<String> = pool.clone();
    let started = Instant::now();
    let mut iteration = 0usize;

    while started.elapsed() < budget || iteration < inputs.len() {
        let input = if iteration < inputs.len() {
            inputs[iteration].clone()
        } else {
            let base = rng.pick(&pool).clone();
            mutate(&mut rng, &base, &pool)
        };
        iteration += 1;

        let call_started = Instant::now();
        let outcome = catch_unwind(AssertUnwindSafe(|| body(&input)));
        let elapsed = call_started.elapsed();

        assert!(
            outcome.is_ok(),
            "{target} panicked\n  seed:      {seed}\n  iteration: {iteration}\n  input:     {input:?}"
        );
        assert!(
            elapsed < PER_INPUT_LIMIT,
            "{target} took {elapsed:?} on one input, which is a hang rather than a scan\n  \
             seed:      {seed}\n  iteration: {iteration}\n  input:     {input:?}"
        );
    }

    println!(
        "fuzz {target}: {iteration} inputs in {:?}, seed {seed}",
        started.elapsed()
    );
}

/// The hardest contract in the crate: two parsers written out by hand
/// because no library is bug-compatible with V8's legacy one.
#[test]
fn date_parse_never_panics_or_hangs() {
    if !enabled() {
        return;
    }
    campaign("date_parse", |input| {
        let _ = parse::date_parse(input);
    });
}

/// The layer above `Date.parse`, which rewrites a refusal into a string
/// V8 does read — including by slicing a word out of the middle of the
/// input, which is where a multi-byte character bites.
#[test]
fn the_layer_above_date_parse_never_panics_or_hangs() {
    if !enabled() {
        return;
    }
    campaign("extended::instant", |input| {
        let _ = extended::instant(input);
        let _ = extended::week_date(input);
        let _ = extended::ordinal_date(input);
        let _ = extended::basic_format(input);
    });
}

/// Every format that changes which patterns run. One per input rather
/// than all six per input: building the patterns dominates the cost of a
/// call — twelve regexes compiled per scan — so scanning six times over
/// would buy six times fewer *inputs* for the same budget. The languages
/// are covered across the campaign instead of within each iteration.
const LANGUAGES: [&str; 6] = ["json", "xml", "log", "javascript", "html", "unknown"];

/// The whole pure scan: the patterns, the containment dedupe, XML
/// comment masking and the position pass.
#[test]
fn the_scan_never_panics_or_hangs() {
    if !enabled() {
        return;
    }
    let next = std::cell::Cell::new(0usize);
    campaign("extract", move |input| {
        let language = LANGUAGES[next.get() % LANGUAGES.len()];
        next.set(next.get() + 1);
        let _ = crate::extract::extract(input, language, 2026);
    });
}
