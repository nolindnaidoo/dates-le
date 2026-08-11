//! `extract_dates` — the tool **both** servers offer.
//!
//! The npm server (`src/mcp/tools.ts`) and this one are meant to be the
//! same tool, not two similar ones: same schema, same envelope,
//! byte-identical output. `fixtures/mcp-extract-dates.json` runs against
//! both, so changing one without the other fails a build.
//!
//! It touches no filesystem. An agent already has file-read tools;
//! duplicating them here would add a path-traversal surface for no
//! capability. The tool that needs a filesystem is `dates_le_scan`.

use serde_json::{Value, json};

use crate::extract::{self, SUPPORTED_FORMATS, resolve_format, time};

const DEFAULT_MAX_RESULTS: usize = 500;
const MAX_MAX_RESULTS: usize = 5000;

pub(crate) fn definition() -> Value {
    json!({
        "name": "extract_dates",
        "description": "Extract every date and timestamp from a document, with its notation, \
                        epoch value where resolvable, and 1-based line and column. Supports \
                        JSON, YAML, CSV, XML, log and plaintext, JavaScript, TypeScript and \
                        HTML. Recognises ISO 8601, RFC formats, common regional notations and \
                        Unix timestamps.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": { "type": "string", "description": "The document text to scan." },
                "format": {
                    "type": "string",
                    "enum": SUPPORTED_FORMATS,
                    "description": "Document format. Provide this or `filename`. Common \
                                    extensions and aliases are accepted.",
                },
                "filename": {
                    "type": "string",
                    "description": "Filename used to infer the format when `format` is absent, \
                                    e.g. \"app.log\".",
                },
                "dedupe": {
                    "type": "boolean",
                    "default": false,
                    "description": "Collapse repeated dates to their first occurrence.",
                },
                "maxResults": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_MAX_RESULTS,
                    "default": DEFAULT_MAX_RESULTS,
                    "description": format!(
                        "Cap on returned dates (default {DEFAULT_MAX_RESULTS}). meta.truncated \
                         reports whether any were dropped."
                    ),
                },
            },
            "required": ["content"],
            "additionalProperties": false,
        },
    })
}

pub(crate) fn run(arguments: &Value) -> Result<Value, String> {
    let content = arguments
        .get("content")
        .and_then(Value::as_str)
        .ok_or_else(|| "content is required and must be a string".to_string())?;
    let max_results = read_max_results(arguments)?;

    // Requiring one of the two up front gives a message naming the
    // problem. Without it an unrecognised format returns an empty
    // result with no error, which reads as "this document has no
    // dates" — the least debuggable answer available.
    let language = resolve_format(
        arguments.get("format").and_then(Value::as_str),
        arguments.get("filename").and_then(Value::as_str),
    )
    .ok_or_else(|| {
        format!(
            "Provide `format` (one of: {}) or a `filename` with a recognised extension.",
            SUPPORTED_FORMATS.join(", ")
        )
    })?;

    // A syslog line carries no year, so extraction here depends on the
    // clock exactly as the extension's does. The CLI can pin it with
    // `--year`; this tool cannot, because the shared schema has no such
    // argument and adding one would make the two servers different
    // tools.
    let mut values: Vec<Value> = extract::extract(content, language, time::current_year())
        .into_iter()
        .map(|found| {
            json!({
                "value": found.value,
                "format": found.notation.as_str(),
                "timestamp": found.timestamp,
                "line": found.line,
                "column": found.column,
            })
        })
        .collect();

    if arguments.get("dedupe").and_then(Value::as_bool) == Some(true) {
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        values.retain(|value| seen.insert(value["value"].to_string()));
    }

    // The `truncated` flag matters more than the cap: a silently
    // incomplete answer is wrong in the most expensive way, and this is
    // a tool whose whole job is completeness.
    let truncated = values.len() > max_results;
    values.truncate(max_results);

    let count = values.len();
    Ok(super::envelope(
        "extract_dates",
        &json!({ "dates": values, "fileType": language }),
        count,
        &[],
        truncated,
    ))
}

/// Clamp quietly, reject loudly — the npm server's asymmetry.
fn read_max_results(arguments: &Value) -> Result<usize, String> {
    let Some(raw) = arguments.get("maxResults") else {
        return Ok(DEFAULT_MAX_RESULTS);
    };
    let invalid = "maxResults must be a positive integer".to_string();
    let value = raw.as_u64().ok_or(invalid.clone())?;
    if value < 1 {
        return Err(invalid);
    }
    Ok(usize::try_from(value)
        .unwrap_or(MAX_MAX_RESULTS)
        .min(MAX_MAX_RESULTS))
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::*;
    use crate::extract::corpus::document;

    const CASES: &str = include_str!("../../fixtures/mcp-extract-dates.json");

    #[derive(Debug, Deserialize)]
    struct Case {
        name: String,
        file: Option<String>,
        content: Option<String>,
        arguments: Value,
        expected: Option<Value>,
        #[serde(rename = "expectedError")]
        expected_error: Option<String>,
    }

    /// The zone is named rather than read from `TZ`, which Windows does
    /// not honour. Same reason as the oracle test in `parse.rs`.
    const TIMEZONE: &str = "America/New_York";

    #[test]
    fn every_shared_case_answers_identically() {
        let cases: Vec<Case> = serde_json::from_str(CASES).expect("the corpus is valid JSON");
        assert!(!cases.is_empty(), "the corpus is empty");
        let zone: chrono_tz::Tz = TIMEZONE.parse().expect("a real timezone");

        for case in cases {
            let mut arguments = case.arguments.clone();
            let content = case
                .file
                .as_deref()
                .map(document)
                .map(str::to_string)
                .or(case.content);
            if let Some(content) = content {
                arguments["content"] = json!(content);
            }

            let answer = time::with_zone(zone, || run(&arguments));
            match (case.expected, case.expected_error) {
                (_, Some(expected)) => {
                    assert_eq!(answer.expect_err(&case.name), expected, "{}", case.name);
                }
                (Some(expected), None) => {
                    assert_eq!(answer.expect(&case.name), expected, "{}", case.name);
                }
                (None, None) => panic!("{} pins neither a result nor an error", case.name),
            }
        }
    }

    #[test]
    fn the_tool_name_is_pinned() {
        assert_eq!(definition()["name"], "extract_dates");
    }

    #[test]
    fn the_advertised_enum_matches_the_formats_that_resolve() {
        let definition = definition();
        let advertised: Vec<String> = definition["inputSchema"]["properties"]["format"]["enum"]
            .as_array()
            .expect("an enum")
            .iter()
            .filter_map(|value| value.as_str().map(str::to_string))
            .collect();
        assert_eq!(advertised, SUPPORTED_FORMATS);
    }

    /// The value shape carries no `timezone`. The extension's does, and
    /// extraction never populates it, so on the wire it is absent —
    /// which is the shape this has to match.
    #[test]
    fn no_answer_carries_an_empty_timezone() {
        let result = run(&json!({ "content": "2024-01-15", "format": "json" })).expect("a result");
        let rendered = serde_json::to_string(&result).expect("serializes");
        assert!(!rendered.contains("timezone"), "{rendered}");
    }

    #[test]
    fn a_fractional_cap_is_refused() {
        let error = run(&json!({ "content": "x", "format": "json", "maxResults": 1.5 }))
            .expect_err("a refusal");
        assert_eq!(error, "maxResults must be a positive integer");
    }

    #[test]
    fn an_excessive_cap_is_clamped_rather_than_refused() {
        let result =
            run(&json!({ "content": "2024-01-15", "format": "json", "maxResults": 99_999 }))
                .expect("a result");
        assert_eq!(result["meta"]["count"], 1);
    }
}
