//! Deciding which files to read.
//!
//! `ignore` is ripgrep's walker, so "what this tool walks" and "what
//! ripgrep walks" are the same answer — which is the answer a person
//! auditing a repository already has in their head.
//!
//! **There is no format filter, and that is the point rather than an
//! omission.** This walk used to skip any file whose name resolved to
//! none of nine formats, which meant a repository of Python, Go, Rust,
//! TOML and Markdown was walked and almost entirely unread — and the
//! reader saw a clean report rather than a skipped one. A date is
//! date-shaped in any text, the base patterns are what every format
//! already runs, so every file is read and `.gitignore` is the only
//! thing that narrows it. `--no-ignore` widens that, `.ignore` files
//! included.
//!
//! **An entry the walk cannot enter is reported, not dropped.** A locked
//! directory used to vanish from the answer, and a tree with one read as
//! clean. It comes back with the file it was meant to stand for, and the
//! report says why it was not read.

use std::path::{Path, PathBuf};

use ignore::WalkBuilder;

#[derive(Debug, Clone, Copy)]
pub(crate) struct WalkOptions {
    pub(crate) hidden: bool,
    pub(crate) respect_ignore: bool,
}

impl Default for WalkOptions {
    fn default() -> Self {
        Self {
            hidden: false,
            respect_ignore: true,
        }
    }
}

/// What a walk found: the files to read, and the entries it could not
/// enter, each with the reason.
#[derive(Debug, Default)]
pub(crate) struct Walked {
    pub(crate) files: Vec<PathBuf>,
    pub(crate) unreadable: Vec<(PathBuf, String)>,
}

/// Every file under `roots`, and every entry the walk could not enter,
/// each in a stable order.
///
/// The sort is not cosmetic: `ignore` makes no ordering guarantee, and a
/// report whose lines move between two runs over an unchanged tree
/// cannot be diffed.
pub(crate) fn collect(roots: &[PathBuf], options: WalkOptions) -> Walked {
    let mut files = Vec::new();
    let mut unreadable = Vec::new();

    for root in roots {
        if root.is_file() {
            files.push(root.clone());
            continue;
        }
        let mut builder = WalkBuilder::new(root);
        builder
            .hidden(!options.hidden)
            .git_ignore(options.respect_ignore)
            .git_global(options.respect_ignore)
            .git_exclude(options.respect_ignore)
            .ignore(options.respect_ignore)
            .parents(options.respect_ignore);

        for entry in builder.build() {
            match entry {
                Ok(entry) if entry.file_type().is_some_and(|kind| kind.is_file()) => {
                    files.push(entry.into_path());
                }
                Ok(_) => {}
                Err(error) => unreadable.push(refusal(&error, root)),
            }
        }
    }

    files.sort();
    files.dedup();
    unreadable.sort();
    unreadable.dedup();
    Walked { files, unreadable }
}

/// The entry an error names, and the I/O error inside it.
fn refusal(error: &ignore::Error, root: &Path) -> (PathBuf, String) {
    let path = match error {
        ignore::Error::WithPath { path, .. } => path.clone(),
        ignore::Error::Loop { child, .. } => child.clone(),
        // Nothing else the walker produces names a path; the root is
        // then the most specific thing that can honestly be reported.
        _ => root.to_path_buf(),
    };
    let reason = error
        .io_error()
        .map_or_else(|| error.to_string(), std::string::ToString::to_string);
    (path, reason)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_default_is_the_walk_a_reader_expects() {
        let options = WalkOptions::default();
        assert!(!options.hidden, "hidden files are skipped");
        assert!(options.respect_ignore, "gitignore is honoured");
    }

    /// A file is collected whatever it is called — `.rs` included, which
    /// the old format filter dropped — and listed once however many
    /// times it was named.
    #[test]
    fn a_named_file_is_collected_whatever_its_extension() {
        let crate_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let source = crate_root.join("src/main.rs");
        let manifest = crate_root.join("Cargo.toml");
        let collected = collect(
            &[manifest.clone(), source.clone(), manifest.clone()],
            WalkOptions::default(),
        );
        assert_eq!(collected.files, [manifest, source]);
    }

    /// The walk reads the tree, not a shortlist of it. `src/` holds only
    /// `.rs` files, every one of which the format filter used to skip.
    #[test]
    fn a_directory_of_unnamed_formats_is_walked_rather_than_skipped() {
        let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
        let collected = collect(&[source], WalkOptions::default()).files;
        assert!(
            collected.iter().any(|path| path.ends_with("walk.rs")),
            "{collected:?}"
        );
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dates-le-walk-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("a scratch directory");
        dir
    }

    /// `--no-ignore` is every ignore file turned off, `.ignore` included.
    #[test]
    fn no_ignore_reads_what_an_ignore_file_names() {
        let dir = scratch("dot-ignore");
        std::fs::write(dir.join(".ignore"), "hidden.txt\n").expect("write");
        std::fs::write(dir.join("hidden.txt"), "2024-01-15\n").expect("write");
        let read = |respect_ignore| {
            collect(
                std::slice::from_ref(&dir),
                WalkOptions {
                    hidden: false,
                    respect_ignore,
                },
            )
            .files
            .iter()
            .any(|path| path.ends_with("hidden.txt"))
        };
        assert!(!read(true), "an .ignore file narrows the default walk");
        assert!(read(false), "--no-ignore reads it");
        std::fs::remove_file(dir.join(".ignore")).expect("tidy");
        std::fs::remove_file(dir.join("hidden.txt")).expect("tidy");
        std::fs::remove_dir(&dir).expect("tidy");
    }

    /// A directory the walk cannot enter comes back with its reason.
    #[cfg(unix)]
    #[test]
    fn a_locked_directory_is_reported_rather_than_dropped() {
        use std::os::unix::fs::PermissionsExt;
        let dir = scratch("locked");
        let locked = dir.join("shut");
        std::fs::create_dir_all(&locked).expect("a directory");
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000)).expect("lock");
        let walked = collect(std::slice::from_ref(&dir), WalkOptions::default());
        let entered = std::fs::read_dir(&locked).is_ok();
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o755)).expect("unlock");
        std::fs::remove_dir(&locked).expect("tidy");
        std::fs::remove_dir(&dir).expect("tidy");
        // Root reads everything, and then there is nothing to report.
        if entered {
            return;
        }
        assert_eq!(walked.unreadable.len(), 1, "{walked:?}");
        assert!(walked.unreadable[0].0.ends_with("shut"));
        assert!(walked.unreadable[0].1.contains("Permission denied"));
    }
}
