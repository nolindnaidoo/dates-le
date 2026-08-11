//! Getting the dates out of a document.
//!
//! Pure: no filesystem, no clock except the year a caller passes in.
//! `walk.rs` and `scan.rs` are where this meets a disk.

pub(crate) mod format;
pub(crate) mod heuristics;
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
/// see `format::resolve_format`. An id with no extractor yields nothing,
/// which is what the extension does too.
pub(crate) fn extract(content: &str, language: &str, year: i64) -> Vec<Found> {
    let patterns = heuristics::patterns_for(language);
    match language {
        // XML comments are masked rather than removed, so a date inside
        // one is skipped without moving anything after it. Matched
        // against the mask, located against the original — the mask can
        // keep the byte length or the UTF-16 length, not both.
        "xml" => heuristics::scan(&mask_xml_comments(content), content, &patterns, year),
        "json" | "yaml" | "csv" | "log" | "plaintext" | "javascript" | "typescript" | "html" => {
            heuristics::scan(content, content, &patterns, year)
        }
        _ => Vec::new(),
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
fn mask_xml_comments(content: &str) -> String {
    let mut out = String::with_capacity(content.len());
    let bytes = content.as_bytes();
    let mut index = 0;

    while index < content.len() {
        if bytes[index..].starts_with(b"<!--") {
            let rest = &content[index..];
            let end = rest.find("-->").map_or(content.len(), |at| index + at + 3);
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
        } else {
            let character = content[index..]
                .chars()
                .next()
                .expect("index is on a character boundary");
            out.push(character);
            index += character.len_utf8();
        }
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
        ] {
            assert_eq!(values("2024-01-15", language), ["2024-01-15"], "{language}");
        }
    }

    #[test]
    fn a_language_with_no_extractor_reads_nothing() {
        assert!(values("2024-01-15", "rust").is_empty());
    }

    #[test]
    fn a_date_in_an_xml_comment_is_skipped() {
        assert!(values("<!-- 2024-01-15 -->", "xml").is_empty());
        assert_eq!(
            values("<!-- 1999-12-31 --><a>2024-01-15</a>", "xml"),
            ["2024-01-15"]
        );
    }

    #[test]
    fn an_unclosed_comment_swallows_the_rest() {
        assert!(values("<!-- 2024-01-15", "xml").is_empty());
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
