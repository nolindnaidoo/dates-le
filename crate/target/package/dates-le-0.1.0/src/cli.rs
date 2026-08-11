//! The terminal surface.
//!
//! stdout is always protocol — one JSON report per line, one line per
//! file. stderr is always for the human, and is a projection of the same
//! reports rather than parallel prose.

use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use crate::extract::{SUPPORTED_FORMATS, parse::date_parse, resolve_format};
use crate::scan::{self, FileReport, ScanOptions};
use crate::walk::{self, WalkOptions};

const USAGE: &str = "usage: dates-le [options] <file|dir>...
       dates-le [options] --stdin --format <format>
       dates-le mcp
       dates-le --version | --help

Finds every date and timestamp in a tree and puts them where a person
can read them: ISO 8601, RFC 2822, Unix epochs, US notations, log and
syslog lines, Apache access logs, and the strings inside date
constructors that nothing else would recognise as dates.

Each one carries the instant it actually resolves to, so `2024-01-15`,
`1705276800` and `Mon, 15 Jan 2024` can be compared rather than read.

Options:
  --after <date>       keep dates at or after this instant
  --before <date>      keep dates strictly before this instant
  --sort               order by instant rather than by position
  --dedupe             collapse repeated dates to their first occurrence
  --iso                add each instant as a UTC ISO 8601 string
  --format <format>    force a format instead of inferring it from the
                       file name
  --year <year>        the year a syslog line is assumed to be in,
                       since the line does not carry one. Defaults to
                       this one, which makes that answer move
  --values             print only the dates, one per line, for piping
  --stdin              read one document from stdin
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes

--after and --before accept anything this tool can read, so
`--after 2024-01-15` and `--after 'March 5, 2024'` both work.

A date with no timezone resolves against this machine's. Set TZ to make
that reproducible; the answer genuinely differs by machine, exactly as
it does for the code being read.

Exit codes follow grep: 0 dates found · 1 none found · 2 malformed
question. Finding none is an answer, not an error.";

/// Every flag the parser accepts. Held equal to the flags named in
/// USAGE by a test, and consulted at runtime so the list is what the
/// parser actually honours.
const FLAGS: [&str; 12] = [
    "--after",
    "--before",
    "--sort",
    "--dedupe",
    "--iso",
    "--format",
    "--year",
    "--values",
    "--stdin",
    "--hidden",
    "--no-ignore",
    "--help",
];

#[derive(Debug)]
struct Invocation {
    scan: ScanOptions,
    walk: WalkOptions,
    values: bool,
    stdin: bool,
    roots: Vec<PathBuf>,
}

pub fn run(arguments: &[String]) -> ExitCode {
    if arguments.first().map(String::as_str) == Some("mcp") {
        return crate::mcp::serve();
    }
    if arguments.iter().any(|argument| argument == "--version") {
        println!("dates-le {}", env!("CARGO_PKG_VERSION"));
        return ExitCode::SUCCESS;
    }
    if arguments.is_empty() || arguments.iter().any(|argument| argument == "--help") {
        println!("{USAGE}");
        return ExitCode::SUCCESS;
    }

    let invocation = match parse_arguments(arguments) {
        Ok(invocation) => invocation,
        Err(message) => return refuse(&message),
    };

    let reports = match gather(&invocation) {
        Ok(reports) => reports,
        Err(message) => return refuse(&message),
    };

    report(&reports, invocation.values);
    scan::exit_code(&reports)
}

fn refuse(message: &str) -> ExitCode {
    eprintln!("dates-le: {message}");
    eprintln!("try `dates-le --help`");
    ExitCode::from(2)
}

fn parse_arguments(arguments: &[String]) -> Result<Invocation, String> {
    let mut invocation = Invocation {
        scan: ScanOptions::default(),
        walk: WalkOptions::default(),
        values: false,
        stdin: false,
        roots: Vec::new(),
    };

    let mut index = 0;
    while index < arguments.len() {
        let argument = arguments[index].as_str();
        let value = |name: &str| -> Result<String, String> {
            arguments
                .get(index + 1)
                .cloned()
                .ok_or_else(|| format!("{name} needs a value"))
        };

        match argument {
            "--after" => {
                let raw = value("--after")?;
                invocation.scan.after = Some(instant(&raw)?);
                index += 1;
            }
            "--before" => {
                let raw = value("--before")?;
                invocation.scan.before = Some(instant(&raw)?);
                index += 1;
            }
            "--format" => {
                let raw = value("--format")?;
                if resolve_format(Some(&raw), None).is_none() {
                    return Err(format!(
                        "unknown format {raw:?} — one of: {}",
                        SUPPORTED_FORMATS.join(", ")
                    ));
                }
                invocation.scan.format = Some(raw);
                index += 1;
            }
            "--year" => {
                let raw = value("--year")?;
                invocation.scan.year = raw
                    .parse()
                    .map_err(|_| format!("--year needs a year, not {raw:?}"))?;
                index += 1;
            }
            "--sort" => invocation.scan.sort = true,
            "--dedupe" => invocation.scan.dedupe = true,
            "--iso" => invocation.scan.iso = true,
            "--values" => invocation.values = true,
            "--stdin" => invocation.stdin = true,
            "--hidden" => invocation.walk.hidden = true,
            "--no-ignore" => invocation.walk.respect_ignore = false,
            other if other.starts_with("--") => {
                return Err(format!(
                    "unknown option {other:?} — one of: {}",
                    FLAGS.join(", ")
                ));
            }
            path => invocation.roots.push(PathBuf::from(path)),
        }
        index += 1;
    }

    if invocation.stdin && invocation.scan.format.is_none() {
        return Err("--stdin needs --format, since there is no file name to infer one from".into());
    }
    if !invocation.stdin && invocation.roots.is_empty() {
        return Err("name a file or directory, or pass --stdin".into());
    }
    Ok(invocation)
}

/// A boundary for `--after` / `--before`, read by the same parser that
/// reads the documents. A tool that could not read its own output as
/// input would be a strange one.
fn instant(raw: &str) -> Result<i64, String> {
    date_parse(raw).ok_or_else(|| format!("{raw:?} is not a date this can read"))
}

fn gather(invocation: &Invocation) -> Result<Vec<FileReport>, String> {
    if invocation.stdin {
        let language = invocation
            .scan
            .format
            .as_deref()
            .and_then(|format| resolve_format(Some(format), None))
            .ok_or("--stdin needs --format")?;
        let mut content = String::new();
        std::io::stdin()
            .read_to_string(&mut content)
            .map_err(|error| format!("could not read stdin: {error}"))?;
        return Ok(vec![scan::scan_text(
            "<stdin>",
            &content,
            language,
            &invocation.scan,
        )]);
    }

    for root in &invocation.roots {
        if !root.exists() {
            return Err(format!("{} does not exist", root.display()));
        }
    }
    let files = walk::collect(&invocation.roots, invocation.walk);
    Ok(files
        .iter()
        .map(|path| scan::scan_file(path, &invocation.scan))
        .collect())
}

fn report(reports: &[FileReport], values_only: bool) {
    let stdout = std::io::stdout();
    let mut out = stdout.lock();

    if values_only {
        for report in reports {
            for date in &report.dates {
                let _ = writeln!(out, "{}", date.value);
            }
        }
        return;
    }

    for report in reports {
        if let Ok(line) = serde_json::to_string(report) {
            let _ = writeln!(out, "{line}");
        }
    }

    let total: usize = reports.iter().map(|report| report.dates.len()).sum();
    let failed = reports
        .iter()
        .filter(|report| report.error.is_some())
        .count();
    let files = reports.len() - failed;
    eprintln!(
        "{total} date{} in {files} file{}{}",
        plural(total),
        plural(files),
        if failed == 0 {
            String::new()
        } else {
            format!(", {failed} unreadable")
        }
    );
    for report in reports.iter().filter(|report| report.error.is_some()) {
        eprintln!(
            "  {}: {}",
            report.file,
            report.error.as_deref().unwrap_or_default()
        );
    }
}

fn plural(count: usize) -> &'static str {
    if count == 1 { "" } else { "s" }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(arguments: &[&str]) -> Result<Invocation, String> {
        parse_arguments(
            &arguments
                .iter()
                .map(|argument| (*argument).to_string())
                .collect::<Vec<_>>(),
        )
    }

    #[test]
    fn every_flag_the_parser_honours_is_documented() {
        for flag in FLAGS {
            assert!(USAGE.contains(flag), "{flag} is not in the usage text");
        }
    }

    #[test]
    fn every_flag_the_usage_names_is_honoured() {
        for word in USAGE.split_whitespace() {
            let flag = word.trim_end_matches([',', '.', '·']);
            if flag.starts_with("--") && flag.len() > 2 {
                assert!(
                    FLAGS.contains(&flag) || flag == "--version",
                    "{flag} is documented and not honoured"
                );
            }
        }
    }

    #[test]
    fn every_exit_code_is_documented() {
        for code in ["0", "1", "2"] {
            assert!(USAGE.contains(code), "exit code {code} is undocumented");
        }
    }

    #[test]
    fn a_boundary_is_read_by_the_same_parser_as_a_document() {
        let invocation = parse(&["--after", "2024-01-15", "."]).expect("parses");
        assert_eq!(invocation.scan.after, Some(1_705_276_800_000));
        let written = parse(&["--after", "March 5, 2024", "."]).expect("parses");
        assert!(written.scan.after.is_some());
    }

    #[test]
    fn a_boundary_that_is_not_a_date_is_refused() {
        let error = parse(&["--after", "soon", "."]).expect_err("refuses");
        assert!(error.contains("not a date"), "{error}");
    }

    #[test]
    fn an_unknown_format_names_the_ones_that_work() {
        let error = parse(&["--format", "rust", "."]).expect_err("refuses");
        assert!(error.contains("typescript"), "{error}");
    }

    #[test]
    fn stdin_without_a_format_is_refused() {
        let error = parse(&["--stdin"]).expect_err("refuses");
        assert!(error.contains("--format"), "{error}");
    }

    #[test]
    fn naming_nothing_at_all_is_refused() {
        let error = parse(&["--sort"]).expect_err("refuses");
        assert!(error.contains("file or directory"), "{error}");
    }

    #[test]
    fn an_unknown_option_is_refused_rather_than_read_as_a_path() {
        let error = parse(&["--nope", "."]).expect_err("refuses");
        assert!(error.contains("--nope"), "{error}");
    }

    #[test]
    fn a_flag_missing_its_value_says_which() {
        assert!(
            parse(&["--after"])
                .expect_err("refuses")
                .contains("--after")
        );
        assert!(parse(&["--year"]).expect_err("refuses").contains("--year"));
    }

    #[test]
    fn a_year_that_is_not_a_number_is_refused() {
        let error = parse(&["--year", "soon", "."]).expect_err("refuses");
        assert!(error.contains("--year"), "{error}");
    }

    #[test]
    fn paths_accumulate() {
        let invocation = parse(&["a.json", "b.log"]).expect("parses");
        assert_eq!(invocation.roots.len(), 2);
    }

    #[test]
    fn the_walk_flags_invert_the_defaults() {
        let invocation = parse(&["--hidden", "--no-ignore", "."]).expect("parses");
        assert!(invocation.walk.hidden);
        assert!(!invocation.walk.respect_ignore);
    }

    #[test]
    fn the_default_year_is_this_one() {
        assert_eq!(
            ScanOptions::default().year,
            crate::extract::time::current_year()
        );
    }
}
