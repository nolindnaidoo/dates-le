//! Resolving a format name to the language id extraction understands.
//!
//! The name a caller sends comes back as `fileType` in every answer, so
//! it is a public contract and not an internal detail. `typescript` and
//! `plaintext` resolve to **themselves**, not to `javascript` and `log`,
//! even though they are read by exactly the same patterns — collapsing
//! them would have the two servers disagree about what they just read.
//!
//! **An unrecognised name is not a refusal.** It resolves to
//! `FALLBACK_FORMAT` and is read with the base patterns, because a
//! format here only ever *adds* patterns to those — log adds syslog and
//! Apache, JavaScript adds constructor arguments, HTML adds attributes —
//! so there is a correct answer for a document nobody named, and
//! refusing to give it was the tool declining to read `.py`, `.go`,
//! `.toml` and `.md` at all.

use super::js;

/// Every name a caller can send, and the language id it means.
const ALIASES: [(&str, &str); 31] = [
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
    // Read by the base patterns like everything unnamed, and named all
    // the same: a caller who says `toml` should not be told `unknown`
    // in the answer's own `fileType` field.
    ("toml", "toml"),
    ("ini", "ini"),
    ("cfg", "ini"),
    ("conf", "ini"),
    ("properties", "properties"),
    ("markdown", "markdown"),
    ("md", "markdown"),
];

/// Two more names that are only ever seen as file extensions.
const EXTENSION_ONLY: [(&str, &str); 2] = [("htm", "html"), ("xhtml", "html")];

/// The names a caller may send, for the tool schema's enum. Held equal
/// to the extension's list by the shared corpus.
pub(crate) const SUPPORTED_FORMATS: [&str; 11] = [
    "json",
    "yaml",
    "csv",
    "xml",
    "log",
    "plaintext",
    "javascript",
    "typescript",
    "html",
    "toml",
    "markdown",
];

/// What a name nothing recognises resolves to.
///
/// `unknown`, not `fallback`, because the extension calls it that and
/// the name is user-visible — it is the `fileType` every answer carries,
/// so a different word here would have the two servers disagree about a
/// field that is right there in the response.
pub(crate) const FALLBACK_FORMAT: &str = "unknown";

/// `value.trim().toLowerCase().replace(/^\./, '')`, character for
/// character.
///
/// Two things here are not the obvious Rust spelling, and both were
/// divergences from the extension on the tool the two servers share:
///
/// - **`js::trim`, not `str::trim`.** JavaScript's whitespace set
///   includes U+FEFF and Rust's does not, so `"\u{feff}json"` resolved
///   to `json` in the editor and `unknown` here — and a name read out of
///   a file that Notepad saved carries one.
/// - **One leading dot, not every leading dot.** `replace(/^\./, '')`
///   strips a single dot, so `..json` is not a format there. It was
///   here.
fn normalise(value: &str) -> String {
    let lowered = js::trim(value).to_lowercase();
    lowered.strip_prefix('.').unwrap_or(&lowered).to_string()
}

fn lookup(name: &str) -> Option<&'static str> {
    let name = normalise(name);
    ALIASES
        .iter()
        .chain(EXTENSION_ONLY.iter())
        .find(|(alias, _)| *alias == name)
        .map(|(_, language)| *language)
}

/// Resolve from an explicit format, else from a filename's extension,
/// else the fallback.
pub(crate) fn resolve_format(format: Option<&str>, filename: Option<&str>) -> &'static str {
    if let Some(language) = format.and_then(lookup) {
        return language;
    }
    filename
        .and_then(|name| name.rsplit_once('.'))
        .and_then(|(_, extension)| lookup(extension))
        .unwrap_or(FALLBACK_FORMAT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_explicit_format_wins() {
        assert_eq!(resolve_format(Some("yml"), None), "yaml");
        assert_eq!(resolve_format(Some(".TS"), None), "typescript");
    }

    #[test]
    fn a_filename_is_the_fallback() {
        assert_eq!(resolve_format(None, Some("app.log")), "log");
        assert_eq!(resolve_format(Some("rust"), Some("a.json")), "json");
    }

    /// The key is user-visible, so these must not collapse into the
    /// language that reads them.
    #[test]
    fn typescript_and_plaintext_are_their_own_keys() {
        assert_eq!(resolve_format(Some("typescript"), None), "typescript");
        assert_eq!(resolve_format(Some("plaintext"), None), "plaintext");
        assert_eq!(resolve_format(Some("tsx"), None), "typescript");
    }

    #[test]
    fn the_configuration_and_prose_names_resolve_to_themselves() {
        assert_eq!(resolve_format(None, Some("pyproject.toml")), "toml");
        assert_eq!(resolve_format(None, Some("setup.cfg")), "ini");
        assert_eq!(resolve_format(None, Some("app.conf")), "ini");
        assert_eq!(resolve_format(None, Some("README.md")), "markdown");
        assert_eq!(resolve_format(Some("markdown"), None), "markdown");
    }

    /// The property the whole file-type story rests on: a name nobody
    /// recognises is read with the base patterns rather than refused.
    #[test]
    fn an_unknown_name_falls_back_rather_than_refusing() {
        assert_eq!(resolve_format(Some("rust"), None), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, Some("main.rs")), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, Some("Makefile")), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, Some("noextension")), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, None), FALLBACK_FORMAT);
    }

    /// Found by the generated differential against the extension. The
    /// name is trimmed before it is looked up, and Rust and JavaScript
    /// disagree about what a trim removes — by exactly two characters,
    /// both named here so a future `str::trim` fails loudly.
    #[test]
    fn the_name_is_trimmed_the_way_javascript_trims() {
        // U+FEFF is whitespace to JavaScript and not to Rust. A name
        // read out of a file that Notepad saved carries one.
        assert_eq!(resolve_format(Some("\u{feff}json"), None), "json");
        assert_eq!(resolve_format(Some("json\u{feff}"), None), "json");
        // U+0085 is whitespace to Rust and not to JavaScript, so it must
        // survive the trim and leave the name unrecognised.
        assert_eq!(resolve_format(Some("\u{85}json"), None), FALLBACK_FORMAT);
        assert_eq!(resolve_format(Some("  json\t"), None), "json");
    }

    /// `replace(/^\./, '')` strips one dot, so a second one is part of
    /// the name and the name is then not a format.
    #[test]
    fn only_one_leading_dot_is_stripped() {
        assert_eq!(resolve_format(Some(".json"), None), "json");
        assert_eq!(resolve_format(Some("..json"), None), FALLBACK_FORMAT);
    }

    #[test]
    fn every_supported_name_resolves() {
        for name in SUPPORTED_FORMATS {
            assert_eq!(resolve_format(Some(name), None), name, "{name}");
        }
    }

    /// The advertised list may not offer a name that then falls back —
    /// that would be an answer keyed `unknown` for a format the schema
    /// promised.
    #[test]
    fn no_advertised_name_is_the_fallback() {
        for name in SUPPORTED_FORMATS {
            assert_ne!(name, FALLBACK_FORMAT);
        }
    }
}
