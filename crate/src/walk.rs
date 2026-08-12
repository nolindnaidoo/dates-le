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
//! thing that narrows it. `--no-ignore` widens that.

use std::path::PathBuf;

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

/// Every file under `roots`, in a stable order.
///
/// The sort is not cosmetic: `ignore` makes no ordering guarantee, and a
/// report whose lines move between two runs over an unchanged tree
/// cannot be diffed.
pub(crate) fn collect(roots: &[PathBuf], options: WalkOptions) -> Vec<PathBuf> {
    let mut files = Vec::new();

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
            .parents(options.respect_ignore);

        for entry in builder.build().filter_map(Result::ok) {
            let path = entry.path();
            if !entry.file_type().is_some_and(|kind| kind.is_file()) {
                continue;
            }
            files.push(path.to_path_buf());
        }
    }

    files.sort();
    files.dedup();
    files
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
        assert_eq!(collected, [manifest, source]);
    }

    /// The walk reads the tree, not a shortlist of it. `src/` holds only
    /// `.rs` files, every one of which the format filter used to skip.
    #[test]
    fn a_directory_of_unnamed_formats_is_walked_rather_than_skipped() {
        let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
        let collected = collect(&[source], WalkOptions::default());
        assert!(
            collected.iter().any(|path| path.ends_with("walk.rs")),
            "{collected:?}"
        );
    }
}
