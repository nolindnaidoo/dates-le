//! dates-le — every date and timestamp in a codebase, and the instant
//! each one resolves to.
//!
//! `extract/` is pure and is where the behaviour lives; `walk` and
//! `scan` are the only modules that touch a filesystem; `cli` and `mcp`
//! are surfaces over the same answers.

pub(crate) mod cli;
pub(crate) mod extract;
/// A time-boxed generative net over `extract/`. Test-only, and outside
/// `extract/` on purpose: that directory is pure and its coverage floor
/// measures the behaviour, not the harness.
#[cfg(test)]
mod fuzz;
pub(crate) mod mcp;
pub(crate) mod scan;
pub(crate) mod walk;

pub use cli::run;
