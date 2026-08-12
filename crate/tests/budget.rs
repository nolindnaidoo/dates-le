//! A wall-clock ceiling, and a shape check on how the cost grows.
//!
//! secrets-le was fifty times slower than its siblings for a release and
//! nobody noticed, because nothing measured it. This crate has its own
//! version of that history: widening the walk to read every file took a
//! scan of a large tree from 0.55s to 1.93s, and the only reason anyone
//! knew is that somebody timed it by hand.
//!
//! Two assertions, and the second is the more valuable:
//!
//! - **A ceiling**, at ten times the local measurement recorded below.
//!   Generous enough not to flake on a shared runner, tight enough to
//!   catch an order of magnitude.
//! - **Linearity**: the same tree four times over may not cost more than
//!   six times as long. That catches the quadratic class directly, which
//!   a ceiling on one size cannot — a quadratic scan passes every
//!   ceiling until the day the tree is big enough.
//!
//! Gated behind `DATES_LE_BUDGET=1` and run on one platform, like
//! `tests/scenarios.rs`: a timing assertion on three operating systems
//! is three chances to flake for one piece of information.
//!
//! **Run it in release.** The job does — a debug binary is several times
//! slower and the number below would mean nothing.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// The measurement this ceiling is ten times.
///
/// 0.72s for the 500-file tree below (about 1.1 MB of text), release
/// build, Apple M-series laptop, 2026-08, three runs within 3ms of each
/// other. A shared CI runner is slower and far more variable, which is
/// what the factor of ten is for: this is a check against an order of
/// magnitude, not a benchmark.
const LOCAL_MEASUREMENT: Duration = Duration::from_millis(720);
const CEILING: Duration = Duration::from_millis(7_200);

/// Four times the tree may cost six times the time. Anything worse than
/// linear-with-slack shows up here long before it shows up as a
/// complaint.
const LINEARITY_FACTOR: f64 = 6.0;

const FILES: usize = 500;

fn enabled() -> bool {
    std::env::var("DATES_LE_BUDGET").as_deref() == Ok("1")
}

/// A deterministic generator, so the tree is the same tree on every
/// machine and the number above is comparable to the number CI gets.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    fn below(&mut self, limit: usize) -> usize {
        (self.next() % limit as u64) as usize
    }
}

/// The tree is generated rather than checked in: five hundred files of a
/// few kilobytes each is a megabyte of fixture nobody would ever read,
/// and a seed reproduces it exactly.
fn build_tree(root: &Path, copies: usize) {
    let extensions = [
        "json", "yaml", "csv", "log", "md", "toml", "ts", "py", "go", "rs", "html", "xml",
    ];
    // A mix of real dates, near-misses and ordinary prose, so the scan
    // is doing the work a real repository asks of it rather than
    // matching on every line or on none.
    let lines = [
        "released: 2024-01-15",
        "\"stamped\": \"2024-01-15T10:30:45Z\"",
        "id = 5551234567",
        "checked at 1705314645123",
        "account 4532015112830366",
        "Mon, 15 Jan 2024 10:30:45 GMT",
        "a line with no date on it at all",
        "ratio = 1.2345678901234567",
        "week: 2024-W03-1",
        "ordinal: 2024-015",
        "# a comment about the release",
        "value: some ordinary text here",
    ];

    let _ = std::fs::remove_dir_all(root);
    std::fs::create_dir_all(root).expect("the tree root is created");
    let mut rng = Rng(0x2024_0115);

    for copy in 0..copies {
        for index in 0..FILES {
            let directory = root.join(format!("copy{copy}")).join(format!(
                "package{}/module{}",
                index % 20,
                index % 7
            ));
            std::fs::create_dir_all(&directory).expect("a directory is created");
            let extension = extensions[index % extensions.len()];
            let mut document = String::with_capacity(2048);
            for _ in 0..40 {
                document.push_str(lines[rng.below(lines.len())]);
                document.push('\n');
            }
            std::fs::write(directory.join(format!("file{index}.{extension}")), document)
                .expect("a file is written");
        }
    }
}

/// One scan of a tree, timed, with the output drained so a full pipe
/// cannot be measured as slowness.
fn scan(root: &Path) -> Duration {
    let started = Instant::now();
    let output = Command::new(env!("CARGO_BIN_EXE_dates-le"))
        .arg(root.as_os_str())
        // Every run names its zone and its year, so neither the machine
        // nor the calendar can move the work.
        .args(["--no-ignore", "--tz", "America/New_York", "--year", "2026"])
        .stdin(Stdio::null())
        .output()
        .expect("the binary runs");
    let elapsed = started.elapsed();
    assert_eq!(
        output.status.code(),
        Some(0),
        "the scan found nothing, so the measurement is of the wrong thing: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    elapsed
}

fn tree(name: &str) -> PathBuf {
    Path::new(env!("CARGO_TARGET_TMPDIR"))
        .join("budget")
        .join(name)
}

#[test]
fn a_five_hundred_file_tree_scans_inside_its_budget() {
    if !enabled() {
        return;
    }
    let root = tree("one");
    build_tree(&root, 1);

    // Twice, and the faster one counts: the first run pays for the page
    // cache on a tree that was written a moment ago, which is not what
    // this is measuring.
    let elapsed = scan(&root).min(scan(&root));
    let _ = std::fs::remove_dir_all(&root);

    assert!(
        elapsed < CEILING,
        "{FILES} files took {elapsed:?}, past the {CEILING:?} ceiling — \
         which is ten times the {LOCAL_MEASUREMENT:?} this was measured at. \
         Something got an order of magnitude slower."
    );
    println!("budget: {FILES} files in {elapsed:?} (ceiling {CEILING:?})");
}

#[test]
fn four_times_the_tree_is_not_more_than_six_times_the_work() {
    if !enabled() {
        return;
    }
    let one = tree("linear-one");
    let four = tree("linear-four");
    build_tree(&one, 1);
    build_tree(&four, 4);

    let small = scan(&one).min(scan(&one));
    let large = scan(&four).min(scan(&four));
    let _ = std::fs::remove_dir_all(&one);
    let _ = std::fs::remove_dir_all(&four);

    let ratio = large.as_secs_f64() / small.as_secs_f64().max(0.001);
    assert!(
        ratio < LINEARITY_FACTOR,
        "four times the tree took {ratio:.1}x the time ({small:?} then {large:?}), \
         which is not linear — a scan that grows faster than its input passes \
         every ceiling until the day the tree is big enough"
    );
    println!("budget: 4x the tree cost {ratio:.2}x the time");
}
