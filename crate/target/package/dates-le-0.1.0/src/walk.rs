//! Deciding which files to read.
//!
//! `ignore` is ripgrep's walker, so "what this tool walks" and "what
//! ripgrep walks" are the same answer — which is the answer a person
//! auditing a repository already has in their head.

use std::path::{Path, PathBuf};

use ignore::WalkBuilder;

use crate::extract::resolve_format;

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

/// Every file under `roots` whose name resolves to a format.
///
/// A file named explicitly is read even if its name resolves to
/// nothing — an explicit argument is an instruction, and refusing it
/// silently would be the worst of both answers. Only *discovered* files
/// are filtered, because walking a repository and reading every `.rs`
/// file for date-shaped text is a lot of work for a lot of noise.
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
            if has_a_format(path) {
                files.push(path.to_path_buf());
            }
        }
    }

    files.sort();
    files.dedup();
    files
}

fn has_a_format(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| resolve_format(None, Some(name)))
        .is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_name_with_no_format_is_not_walked() {
        assert!(has_a_format(Path::new("a/b/app.log")));
        assert!(has_a_format(Path::new("events.json")));
        assert!(!has_a_format(Path::new("main.rs")));
        assert!(!has_a_format(Path::new("Makefile")));
    }

    #[test]
    fn the_default_is_the_walk_a_reader_expects() {
        let options = WalkOptions::default();
        assert!(!options.hidden, "hidden files are skipped");
        assert!(options.respect_ignore, "gitignore is honoured");
    }
}
