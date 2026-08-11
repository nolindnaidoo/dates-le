//! Resolving a format name to the language id extraction understands.
//!
//! The name a caller sends comes back as `fileType` in every answer, so
//! it is a public contract and not an internal detail. `typescript` and
//! `plaintext` resolve to **themselves**, not to `javascript` and `log`,
//! even though they are read by exactly the same patterns — collapsing
//! them would have the two servers disagree about what they just read.
//!
//! An unrecognised name resolves to nothing rather than to a guess. A
//! wrong format extracts nothing and looks identical to a document with
//! no dates in it, which is the least debuggable answer available.

/// Every name a caller can send, and the language id it means.
const ALIASES: [(&str, &str); 24] = [
    ("json", "json"),
    ("jsonc", "json"),
    ("yaml", "yaml"),
    ("yml", "yaml"),
    ("csv", "csv"),
    ("tsv", "csv"),
    ("xml", "xml"),
    ("log", "log"),
    ("txt", "plaintext"),
    ("text", "plaintext"),
    ("plaintext", "plaintext"),
    ("javascript", "javascript"),
    ("js", "javascript"),
    ("jsx", "javascript"),
    ("mjs", "javascript"),
    ("cjs", "javascript"),
    ("javascriptreact", "javascript"),
    ("typescript", "typescript"),
    ("ts", "typescript"),
    ("tsx", "typescript"),
    ("mts", "typescript"),
    ("cts", "typescript"),
    ("typescriptreact", "typescript"),
    ("html", "html"),
];

/// Two more names that are only ever seen as file extensions.
const EXTENSION_ONLY: [(&str, &str); 2] = [("htm", "html"), ("xhtml", "html")];

/// The names a caller may send, for the tool schema's enum. Held equal
/// to the extension's list by the shared corpus.
pub(crate) const SUPPORTED_FORMATS: [&str; 9] = [
    "json",
    "yaml",
    "csv",
    "xml",
    "log",
    "plaintext",
    "javascript",
    "typescript",
    "html",
];

fn normalise(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .trim_start_matches('.')
        .to_string()
}

fn lookup(name: &str) -> Option<&'static str> {
    let name = normalise(name);
    ALIASES
        .iter()
        .chain(EXTENSION_ONLY.iter())
        .find(|(alias, _)| *alias == name)
        .map(|(_, language)| *language)
}

/// Resolve from an explicit format, else from a filename's extension.
pub(crate) fn resolve_format(format: Option<&str>, filename: Option<&str>) -> Option<&'static str> {
    if let Some(language) = format.and_then(lookup) {
        return Some(language);
    }
    let extension = filename?.rsplit_once('.')?.1;
    lookup(extension)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_explicit_format_wins() {
        assert_eq!(resolve_format(Some("yml"), None), Some("yaml"));
        assert_eq!(resolve_format(Some(".TS"), None), Some("typescript"));
    }

    #[test]
    fn a_filename_is_the_fallback() {
        assert_eq!(resolve_format(None, Some("app.log")), Some("log"));
        assert_eq!(resolve_format(Some("rust"), Some("a.json")), Some("json"));
    }

    /// The key is user-visible, so these must not collapse into the
    /// language that reads them.
    #[test]
    fn typescript_and_plaintext_are_their_own_keys() {
        assert_eq!(resolve_format(Some("typescript"), None), Some("typescript"));
        assert_eq!(resolve_format(Some("plaintext"), None), Some("plaintext"));
        assert_eq!(resolve_format(Some("tsx"), None), Some("typescript"));
    }

    #[test]
    fn an_unknown_name_resolves_to_nothing() {
        assert_eq!(resolve_format(Some("rust"), None), None);
        assert_eq!(resolve_format(None, Some("main.rs")), None);
        assert_eq!(resolve_format(None, Some("noextension")), None);
        assert_eq!(resolve_format(None, None), None);
    }

    #[test]
    fn every_supported_name_resolves() {
        for name in SUPPORTED_FORMATS {
            assert_eq!(resolve_format(Some(name), None), Some(name), "{name}");
        }
    }
}
