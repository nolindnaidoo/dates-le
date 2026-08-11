//! The agent surface: the same extraction over the Model Context
//! Protocol on stdio, so a model can ask for the dates rather than be
//! handed the files and pattern-match them itself.
//!
//! Two rules the family's MCP surfaces established:
//!
//! - **An empty answer is not an error.** A document with no dates comes
//!   back as an ordinary result carrying `ok: true` — the scan ran.
//!   Only a malformed question is a protocol error.
//! - **Refusals speak the caller's vocabulary.** An MCP caller has no
//!   command line, so no message here mentions a flag.
//!
//! Read-only by construction: nothing on this surface writes.

pub(crate) mod extract;

use std::io::{BufRead, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use serde_json::{Value, json};

use crate::extract::{SUPPORTED_FORMATS, resolve_format};
use crate::scan::{self, ScanOptions};
use crate::walk::{self, WalkOptions};

const PROTOCOL_VERSION: &str = "2025-06-18";

/// JSON-RPC error codes, from the spec.
const INVALID_PARAMS: i64 = -32602;
const METHOD_NOT_FOUND: i64 = -32601;

pub(crate) fn serve() -> ExitCode {
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else {
            return ExitCode::from(2);
        };
        if line.trim().is_empty() {
            continue;
        }
        let Ok(request) = serde_json::from_str::<Value>(&line) else {
            // A frame that is not JSON has no id to answer against;
            // dropping it is the only honest option.
            continue;
        };
        let Some(response) = handle(&request) else {
            continue; // a notification: no reply
        };
        if writeln!(stdout, "{response}").is_err() || stdout.flush().is_err() {
            return ExitCode::from(2);
        }
    }
    ExitCode::SUCCESS
}

fn handle(request: &Value) -> Option<Value> {
    let id = request.get("id").cloned();
    let method = request.get("method")?.as_str()?;
    // Notifications carry no id and get no reply.
    id.as_ref()?;

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "dates-le", "version": env!("CARGO_PKG_VERSION") },
        })),
        "tools/list" => Ok(json!({ "tools": tool_definitions() })),
        "tools/call" => call_tool(request.get("params")),
        "ping" => Ok(json!({})),
        other => Err((
            METHOD_NOT_FOUND,
            format!("this server does not implement {other}"),
        )),
    };

    Some(match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err((code, message)) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": code, "message": message },
        }),
    })
}

fn tool_definitions() -> Value {
    json!([
        extract::definition(),
        {
            "name": "dates_le_scan",
            "description": "Extract every date and timestamp from files or directories, with \
                            the file it came from, its notation, the instant it resolves to, \
                            and its line and column. Reads the filesystem; never writes to it. \
                            Files whose name resolves to no supported format are skipped.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "a file or directory to read" },
                    "paths": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "several files or directories, instead of `path`",
                    },
                    "format": {
                        "type": "string",
                        "enum": SUPPORTED_FORMATS,
                        "description": "Force a format for every file instead of inferring one \
                                        per file name.",
                    },
                    "after": {
                        "type": "string",
                        "description": "Keep only dates at or after this instant. Accepts any \
                                        notation this tool reads, e.g. \"2024-01-15\".",
                    },
                    "before": {
                        "type": "string",
                        "description": "Keep only dates strictly before this instant.",
                    },
                    "sort": {
                        "type": "boolean",
                        "default": false,
                        "description": "Order by instant rather than by position in the file.",
                    },
                    "dedupe": {
                        "type": "boolean",
                        "default": false,
                        "description": "Collapse repeated dates to their first occurrence.",
                    },
                    "hidden": {
                        "type": "boolean",
                        "default": false,
                        "description": "Walk hidden files and directories too.",
                    },
                    "ignored": {
                        "type": "boolean",
                        "default": false,
                        "description": "Walk files excluded by .gitignore too.",
                    },
                },
            },
        },
    ])
}

/// Protocol failures (no tool named, an unknown tool) are JSON-RPC
/// errors; a tool that fails on its arguments returns a result carrying
/// `isError`, so a model reads the reason and reacts rather than
/// concluding the server is broken. Same rule as the npm server.
fn call_tool(params: Option<&Value>) -> Result<Value, (i64, String)> {
    let params = params.ok_or((INVALID_PARAMS, "no tool call was supplied".to_string()))?;
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or((INVALID_PARAMS, "the tool call named no tool".to_string()))?;
    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));

    match name {
        "extract_dates" => Ok(match extract::run(&arguments) {
            Ok(result) => tool_result(&result),
            Err(message) => tool_failure(&message),
        }),
        "dates_le_scan" => Ok(match scan_tool(&arguments) {
            Ok(result) => tool_result(&result),
            Err(message) => tool_failure(&message),
        }),
        other => Err((
            INVALID_PARAMS,
            format!("this server offers no tool named {other}"),
        )),
    }
}

fn scan_tool(arguments: &Value) -> Result<Value, String> {
    let inputs = requested_paths(arguments)?;
    let flag = |name: &str| {
        arguments
            .get(name)
            .and_then(Value::as_bool)
            .unwrap_or(false)
    };
    let boundary = |name: &str| -> Result<Option<i64>, String> {
        match arguments.get(name).and_then(Value::as_str) {
            None => Ok(None),
            Some(raw) => crate::extract::parse::date_parse(raw)
                .map(Some)
                .ok_or_else(|| format!("`{name}` is not a date this can read: {raw:?}")),
        }
    };

    if let Some(format) = arguments.get("format").and_then(Value::as_str)
        && resolve_format(Some(format), None).is_none()
    {
        return Err(format!(
            "unknown format {format:?} — one of: {}",
            SUPPORTED_FORMATS.join(", ")
        ));
    }

    let options = ScanOptions {
        format: arguments
            .get("format")
            .and_then(Value::as_str)
            .map(str::to_string),
        dedupe: flag("dedupe"),
        sort: flag("sort"),
        iso: false,
        after: boundary("after")?,
        before: boundary("before")?,
        year: crate::extract::time::current_year(),
    };
    let walk_options = WalkOptions {
        hidden: flag("hidden"),
        respect_ignore: !flag("ignored"),
    };

    let targets = walk::collect(&inputs, walk_options);
    let reports: Vec<scan::FileReport> = targets
        .iter()
        .map(|target| scan::scan_file(target, &options))
        .collect();

    let dates: usize = reports.iter().map(|report| report.dates.len()).sum();
    let diagnostics: Vec<Value> = reports
        .iter()
        .filter(|report| report.skipped.is_some())
        .map(|report| {
            warning(
                "skipped",
                &format!(
                    "{} was not read, so this scan does not cover it",
                    report.file
                ),
            )
        })
        .collect();

    let count = reports.len();
    let reports: Vec<Value> = reports
        .iter()
        .map(|report| serde_json::to_value(report).expect("a report serializes"))
        .collect();

    Ok(envelope(
        "dates_le_scan",
        &json!({ "reports": reports, "dates": dates }),
        count,
        &diagnostics,
        false,
    ))
}

fn requested_paths(arguments: &Value) -> Result<Vec<PathBuf>, String> {
    if let Some(path) = arguments.get("path").and_then(Value::as_str) {
        return Ok(vec![PathBuf::from(path)]);
    }
    if let Some(items) = arguments.get("paths").and_then(Value::as_array) {
        let paths: Vec<PathBuf> = items
            .iter()
            .filter_map(|item| item.as_str().map(PathBuf::from))
            .collect();
        if paths.is_empty() {
            return Err("the list of paths was empty".to_string());
        }
        return Ok(paths);
    }
    Err("no file or directory was supplied to read".to_string())
}

/// The one result shape every tool returns, matching the npm server's
/// envelope field for field: `{ ok, data, diagnostics, meta }`.
///
/// **`ok` reports whether the scan ran, not whether it found anything.**
/// A file with no dates in it is the answer, not a failure to produce
/// one.
pub(crate) fn envelope(
    tool: &str,
    data: &Value,
    count: usize,
    diagnostics: &[Value],
    truncated: bool,
) -> Value {
    let ok = !diagnostics
        .iter()
        .any(|diagnostic| diagnostic["severity"].as_str() == Some("error"));
    json!({
        "ok": ok,
        "data": data,
        "diagnostics": diagnostics,
        "meta": { "tool": tool, "count": count, "truncated": truncated },
    })
}

/// An MCP tool result: the envelope as text (what a model reads) and
/// the same envelope structured. Identical to what the npm server
/// emits, so a caller diffing the two servers finds nothing.
fn tool_result(envelope: &Value) -> Value {
    let text = serde_json::to_string_pretty(envelope).expect("an envelope serializes");
    json!({
        "content": [{ "type": "text", "text": text }],
        "structuredContent": envelope,
        "isError": false,
    })
}

fn warning(code: &str, message: &str) -> Value {
    json!({ "severity": "warning", "code": code, "message": message })
}

/// The tool could not run on the arguments given. `isError` so a model
/// reads the message and corrects itself.
fn tool_failure(message: &str) -> Value {
    json!({
        "content": [{ "type": "text", "text": message }],
        "isError": true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(method: &str, params: &Value) -> Value {
        json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params })
    }

    fn call(name: &str, arguments: &Value) -> Value {
        handle(&request(
            "tools/call",
            &json!({ "name": name, "arguments": arguments }),
        ))
        .expect("a reply")
    }

    #[test]
    fn initialize_answers_with_the_protocol_version() {
        let response = handle(&request("initialize", &json!({}))).expect("a reply");
        assert_eq!(response["result"]["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(response["result"]["serverInfo"]["name"], "dates-le");
    }

    #[test]
    fn tools_list_offers_both_tools() {
        let response = handle(&request("tools/list", &json!({}))).expect("a reply");
        let tools = response["result"]["tools"].as_array().expect("tools");
        let names: Vec<&str> = tools.iter().filter_map(|t| t["name"].as_str()).collect();
        assert_eq!(names, ["extract_dates", "dates_le_scan"]);
    }

    #[test]
    fn a_notification_gets_no_reply() {
        let notification = json!({ "jsonrpc": "2.0", "method": "initialized" });
        assert!(handle(&notification).is_none());
    }

    #[test]
    fn an_unknown_method_is_a_protocol_error() {
        let response = handle(&request("nope", &json!({}))).expect("a reply");
        assert_eq!(response["error"]["code"], METHOD_NOT_FOUND);
    }

    #[test]
    fn an_unknown_tool_is_a_protocol_error() {
        let response = call("nope", &json!({}));
        assert_eq!(response["error"]["code"], INVALID_PARAMS);
    }

    /// A tool that cannot run on its arguments is not a broken server.
    #[test]
    fn bad_arguments_are_a_tool_failure_not_a_protocol_error() {
        let response = call("dates_le_scan", &json!({}));
        assert_eq!(response["result"]["isError"], true);
        assert!(response["error"].is_null());
    }

    #[test]
    fn a_boundary_that_is_not_a_date_says_so() {
        let response = call("dates_le_scan", &json!({ "path": ".", "after": "soon" }));
        assert_eq!(response["result"]["isError"], true);
        let text = response["result"]["content"][0]["text"]
            .as_str()
            .unwrap_or_default();
        assert!(text.contains("after"), "{text}");
    }

    #[test]
    fn an_unknown_format_names_the_ones_that_work() {
        let response = call("dates_le_scan", &json!({ "path": ".", "format": "rust" }));
        let text = response["result"]["content"][0]["text"]
            .as_str()
            .unwrap_or_default();
        assert!(text.contains("typescript"), "{text}");
    }

    #[test]
    fn an_empty_list_of_paths_is_refused() {
        let response = call("dates_le_scan", &json!({ "paths": [] }));
        assert_eq!(response["result"]["isError"], true);
    }

    /// No message on this surface mentions a flag: an MCP caller has no
    /// command line to type one on.
    #[test]
    fn refusals_never_mention_a_flag() {
        for arguments in [json!({}), json!({ "paths": [] })] {
            let response = call("dates_le_scan", &arguments);
            let text = response["result"]["content"][0]["text"]
                .as_str()
                .unwrap_or_default();
            assert!(!text.contains("--"), "{text}");
        }
    }

    #[test]
    fn scanning_a_corpus_document_reports_it() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/fixtures/documents/events.json"
        );
        let response = call("dates_le_scan", &json!({ "path": path }));
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["meta"]["count"], 1);
        assert!(envelope["data"]["dates"].as_u64().unwrap_or(0) > 0);
    }

    #[test]
    fn ping_answers() {
        let response = handle(&request("ping", &json!({}))).expect("a reply");
        assert!(response["result"].is_object());
    }
}
