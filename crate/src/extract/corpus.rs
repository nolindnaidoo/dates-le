//! The shared corpus documents, embedded.
//!
//! `include_str!` rather than a filesystem read, so `cargo test` on an
//! unpacked tarball runs the same corpus the extension does without
//! needing the repository around it. The files themselves are the
//! contract and live in `fixtures/documents/`.

macro_rules! documents {
    ($($name:literal),* $(,)?) => {
        /// A corpus document by name, or a panic — a corpus case naming
        /// a file that is not here is a broken test, not a runtime
        /// condition.
        pub(crate) fn document(name: &str) -> &'static str {
            match name {
                $($name => include_str!(concat!("../../fixtures/documents/", $name)),)*
                other => panic!("no corpus document named {other:?}"),
            }
        }

        /// Every document, so a test can assert the corpus covers them.
        pub(crate) const DOCUMENTS: &[&str] = &[$($name),*];
    };
}

documents!(
    "app.log",
    "calendar.js",
    "dates.ts",
    "events.json",
    "feed.xml",
    "handler.go",
    "notations.txt",
    "page.html",
    "pyproject.toml",
    "release-notes.md",
    "rows.csv",
    "schedule.yaml",
    "settings.py",
);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_document_is_present_and_not_empty() {
        for name in DOCUMENTS {
            assert!(!document(name).is_empty(), "{name}");
        }
    }

    #[test]
    #[should_panic(expected = "no corpus document named")]
    fn an_unknown_document_is_a_broken_test() {
        document("nope.json");
    }
}
