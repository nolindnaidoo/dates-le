//! Byte offset to line and column.
//!
//! Columns count **UTF-16 code units**, which is what an editor reports
//! and therefore what the extension produces. Bytes would be wrong for
//! anything accented and characters would be wrong for anything outside
//! the basic plane, so a line with an emoji on it distinguishes all
//! three — `fixtures/documents/schedule.yaml` has one for that reason.
//!
//! JavaScript gets the column by subtracting two offsets, because its
//! strings are indexed in UTF-16 units already. Rust has to count, and
//! counting from the start of the line for each match is quadratic on a
//! long line — a log file with two hundred thousand timestamps on one
//! line took longer than anyone would wait. So the offsets are resolved
//! **together, in one ordered pass** over the document: linear in the
//! document plus the number of matches, whatever their distribution.

/// Resolve a set of ascending byte offsets to 1-based line and UTF-16
/// column.
///
/// `offsets` must be ascending — which they are, because containment
/// dedupe sorts by start and keeps that order. The pass walks the
/// document once and cannot go back.
pub(crate) fn locate_all(content: &str, offsets: &[usize]) -> Vec<(usize, usize)> {
    debug_assert!(
        offsets.windows(2).all(|pair| pair[0] <= pair[1]),
        "offsets must ascend: this walks the document once and cannot go back"
    );

    let mut located = Vec::with_capacity(offsets.len());
    let mut characters = content.char_indices().peekable();
    let mut line = 1;
    let mut column = 1;
    let mut at = 0;

    for &offset in offsets {
        let offset = offset.min(content.len());
        while at < offset {
            let Some((index, character)) = characters.next() else {
                break;
            };
            at = index + character.len_utf8();
            if character == '\n' {
                line += 1;
                column = 1;
            } else {
                column += character.len_utf16();
            }
        }
        located.push((line, column));
    }
    located
}

#[cfg(test)]
mod tests {
    use super::*;

    fn locate(content: &str, offset: usize) -> (usize, usize) {
        locate_all(content, &[offset])[0]
    }

    #[test]
    fn the_first_character_is_line_one_column_one() {
        assert_eq!(locate("abc", 0), (1, 1));
    }

    #[test]
    fn a_newline_starts_the_next_line() {
        assert_eq!(locate("ab\ncd", 2), (1, 3));
        assert_eq!(locate("ab\ncd", 3), (2, 1));
        assert_eq!(locate("ab\ncd", 4), (2, 2));
    }

    #[test]
    fn an_empty_line_still_counts() {
        assert_eq!(locate("a\n\nb", 3), (3, 1));
    }

    /// Two bytes, one character, one UTF-16 unit.
    #[test]
    fn an_accented_character_is_one_column() {
        let content = "café x";
        assert_eq!(locate(content, content.find('x').unwrap()), (1, 6));
    }

    /// Four bytes, one character, **two** UTF-16 units — the case that
    /// tells this apart from counting characters.
    #[test]
    fn an_astral_character_is_two_columns() {
        let content = "🗓 x";
        assert_eq!(locate(content, content.find('x').unwrap()), (1, 4));
    }

    #[test]
    fn an_offset_past_the_end_is_clamped() {
        assert_eq!(locate("ab", 99), (1, 3));
    }

    #[test]
    fn several_offsets_resolve_in_one_pass() {
        let content = "2024\né\n🗓x";
        let offsets = [0, 5, 8, content.find('x').unwrap()];
        assert_eq!(
            locate_all(content, &offsets),
            [(1, 1), (2, 1), (3, 1), (3, 3)]
        );
    }

    #[test]
    fn no_offsets_is_no_work() {
        assert!(locate_all("anything", &[]).is_empty());
    }

    /// Repeats are legal — two patterns can match at the same place —
    /// and must not advance the pass.
    #[test]
    fn a_repeated_offset_resolves_the_same_way() {
        assert_eq!(locate_all("ab\ncd", &[3, 3]), [(2, 1), (2, 1)]);
    }
}
