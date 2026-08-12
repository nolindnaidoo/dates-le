//! Getting the dates out of a document.
//!
//! Pure: no filesystem, no clock except the year a caller passes in.
//! `walk.rs` and `scan.rs` are where this meets a disk.

pub(crate) mod extended;
pub(crate) mod format;
pub(crate) mod heuristics;
/// JavaScript's whitespace, which is not Rust's. Everything in this
/// directory that trims or matches `\s` goes through it.
mod js;
pub(crate) mod parse;
pub(crate) mod position;
pub(crate) mod time;

#[cfg(test)]
pub(crate) mod corpus;

pub(crate) use format::{SUPPORTED_FORMATS, resolve_format};
pub(crate) use heuristics::Found;

/// Every date in a document, in the order they appear.
///
/// `language` is a resolved language id, not a caller's name for it —
/// see `format::resolve_format`. **An id with no extractor of its own is
/// read with the base patterns**, not skipped: a format only ever adds
/// patterns to those, so the base scan is the honest answer for a `.py`
/// or a `.toml` rather than a shrug. The extension does the same.
pub(crate) fn extract(content: &str, language: &str, year: i64) -> Vec<Found> {
    let patterns = heuristics::patterns_for(language);
    match language {
        // XML comments are masked rather than removed, so a date inside
        // one is skipped without moving anything after it. Matched
        // against the mask, located against the original — the mask can
        // keep the byte length or the UTF-16 length, not both.
        "xml" => heuristics::scan(&mask_xml_comments(content), content, &patterns, year),
        _ => heuristics::scan(content, content, &patterns, year),
    }
}

/// Blank the contents of every XML comment, keeping the document's
/// length exactly.
///
/// **The length is the point.** Every offset downstream is a byte offset
/// into this string, so a multi-byte character replaced by one space
/// slides every offset after it — far enough, eventually, to slice
/// through the middle of a character and abort the process. The
/// extension gets this for free because JavaScript replaces a character
/// with a character; here it has to be done on purpose, padding by the
/// character's own byte length.
///
/// **A comment nobody closed is not a comment.** The extension masks
/// with `/<!--[\s\S]*?-->/`, which needs the closing marker, so
/// `<a>1</a><!-- 2024-01-15` still yields that date there. This used to
/// swallow the rest of the document instead — a divergence between the
/// two servers on the one tool they are meant to share, and not one
/// SPEC.md listed. The closing marker is also searched for *after* the
/// four characters that open the comment, for the same reason the
/// extension's `*?` starts there: `<!-->` is not an empty comment.
fn mask_xml_comments(content: &str) -> String {
    let mut out = String::with_capacity(content.len());
    let mut index = 0;

    while index < content.len() {
        let after_open = index + "<!--".len();
        if content[index..].starts_with("<!--")
            && let Some(at) = content[after_open..].find("-->")
        {
            let end = after_open + at + "-->".len();
            for character in content[index..end].chars() {
                if character == '\n' {
                    out.push('\n');
                } else {
                    for _ in 0..character.len_utf8() {
                        out.push(' ');
                    }
                }
            }
            index = end;
            continue;
        }
        let character = content[index..]
            .chars()
            .next()
            .expect("index is on a character boundary");
        out.push(character);
        index += character.len_utf8();
    }

    debug_assert_eq!(
        out.len(),
        content.len(),
        "masking changed the document's byte length"
    );
    out
}

#[cfg(test)]
mod tests {
    use super::format::FALLBACK_FORMAT;
    use super::*;

    fn values(content: &str, language: &str) -> Vec<String> {
        extract(content, language, 2026)
            .into_iter()
            .map(|found| found.value)
            .collect()
    }

    #[test]
    fn every_format_with_an_extractor_reads_a_bare_date() {
        for language in [
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
        ] {
            assert_eq!(values("2024-01-15", language), ["2024-01-15"], "{language}");
        }
    }

    /// The change that made this tool readable over a whole repository:
    /// a language with no extractor of its own gets the base patterns,
    /// where it used to get nothing at all.
    #[test]
    fn a_language_with_no_extractor_of_its_own_still_reads_a_date() {
        for language in [FALLBACK_FORMAT, "rust", "python", "go", "sql"] {
            assert_eq!(values("2024-01-15", language), ["2024-01-15"], "{language}");
        }
    }

    /// It gets the base patterns and only those. A syslog line is a date
    /// in a log and three words in a Python file, and the format is the
    /// only thing that can tell them apart.
    #[test]
    fn the_fallback_adds_no_format_specific_patterns() {
        assert!(values("Jan 15 10:30:47", FALLBACK_FORMAT).is_empty());
        assert!(values("new Date('March 5, 2024')", FALLBACK_FORMAT).is_empty());
    }

    #[test]
    fn a_date_in_an_xml_comment_is_skipped() {
        assert!(values("<!-- 2024-01-15 -->", "xml").is_empty());
        assert_eq!(
            values("<!-- 1999-12-31 --><a>2024-01-15</a>", "xml"),
            ["2024-01-15"]
        );
    }

    /// Found by the generated differential against the extension: this
    /// swallowed the rest of the document, the extension masked nothing,
    /// and the shared `extract_dates` tool answered two different
    /// things. The extension is the reference implementation.
    #[test]
    fn a_comment_nobody_closed_is_not_a_comment() {
        assert_eq!(values("<!-- 2024-01-15", "xml"), ["2024-01-15"]);
        assert_eq!(
            values("<a>1</a><!-- 2024-01-15", "xml"),
            ["2024-01-15"],
            "an unclosed comment must not hide what follows it either"
        );
    }

    /// The closing marker is searched for after the four characters that
    /// open the comment, so the two `-` in `<!--` cannot be read as the
    /// start of one. `<!-->` is not an empty comment in XML and is not
    /// one to the extension's regex either.
    #[test]
    fn the_opening_marker_cannot_close_itself() {
        assert_eq!(values("<!-->2024-01-15", "xml"), ["2024-01-15"]);
        assert_eq!(values("<!--->2024-01-15", "xml"), ["2024-01-15"]);
        assert_eq!(values("<!---->2024-01-15", "xml"), ["2024-01-15"]);
        assert!(values("<!--2024-01-15-->", "xml").is_empty());
    }

    /// The bug this class of code causes, pinned three ways: the length
    /// is unchanged, the newlines survive so line numbers hold, and a
    /// date after a multi-byte comment keeps its real column.
    #[test]
    fn masking_preserves_the_byte_length() {
        for content in [
            "<!-- café -->",
            "<!-- Résumé — año -->",
            "<!--\n2024\n-->",
            "<a>é</a><!-- ✓ -->",
        ] {
            assert_eq!(
                mask_xml_comments(content).len(),
                content.len(),
                "{content:?}"
            );
        }
    }

    #[test]
    fn masking_keeps_the_lines_it_spans() {
        let masked = mask_xml_comments("<!--\na\nb\n-->x");
        assert_eq!(masked.lines().count(), 4);
        assert!(masked.ends_with('x'));
    }

    #[test]
    fn a_date_after_a_multibyte_comment_keeps_its_column() {
        let found = extract("<a><!-- café — naïve -->2024-01-15</a>", "xml", 2026);
        assert_eq!(found.len(), 1);
        assert_eq!((found[0].line, found[0].column), (1, 25));
    }
}
