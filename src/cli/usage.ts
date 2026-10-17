/**
 * The command line's help text and the flags it names.
 *
 * Word for word the Rust CLI's, because both install as `dates-le` and a
 * person reading `--help` cannot tell which one they have.
 * `scripts/check-cli-parity.ts` compares the two outputs, and `cli.test.ts`
 * holds FLAGS equal to the flags this text names.
 */

export const USAGE = `usage: dates-le [options] <file|dir>...
       dates-le [options] --stdin [--format <format>]
       dates-le mcp
       dates-le --version | --help

Finds every date and timestamp in a tree and puts them where a person
can read them: ISO 8601 in every form it is written — extended, basic,
week and ordinal — RFC 2822, Unix epochs from seconds to nanoseconds,
day-first and month-first numeric dates, dates with the month
written out, log and syslog lines, Apache access logs, and the strings
inside date constructors that nothing else would recognise as dates.

Every file is read. A name that matches no format is scanned with the
patterns every format shares, so a .py, .go, .toml or .md file yields
its dates rather than being skipped.

Each one carries the instant it actually resolves to, so \`2024-01-15\`,
\`1705276800\` and \`Mon, 15 Jan 2024\` can be compared rather than read.

One JSON report per line on stdout when it is piped or redirected, every
date listed on stderr.

Options:
  --after <date>       keep dates at or after this instant
  --before <date>      keep dates strictly before this instant
  --sort               order by instant rather than by position
  --dedupe             collapse repeated dates to their first occurrence
  --iso                add each instant as a UTC ISO 8601 string
  --tz <zone>          resolve dates that carry no timezone in this
                       IANA zone, e.g. UTC or America/New_York, instead
                       of this machine's
  --format <format>    force a format instead of inferring it from the
                       file name; a name nothing recognises falls back
                       to the shared patterns rather than failing
  --date-order <order> how to read a numeric date whose day and month
                       could be either way round: mdy (the default)
                       reads 05/01/2024 as 1 May, dmy as 5 January.
                       15/01/2024 and 1/15/2024 are read the one way
                       they can be, and 05.01.2024 is always day first
  --kinds <kinds>      the kinds of date to report, separated by commas:
                       iso, simple, local, rfc2822, utc, week, ordinal,
                       basic, custom, unix. Defaults to every kind but
                       unix: a bare number such as 1705314645 is only
                       read as a date when unix is listed
  --year <year>        the year a syslog line is assumed to be in,
                       since the line does not carry one. Defaults to
                       this one, which makes that answer move
  --values             print only the dates, one per line, for piping
  --strict             exit 2 if any file could not be read, rather than
                       reporting it and carrying on
  --stdin              read one document from stdin
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes

--after and --before accept anything this tool can read, so
\`--after 2024-01-15\` and \`--after 'March 5, 2024'\` both work.

A date with no timezone resolves against this machine's. Use --tz to
name one instead; the answer genuinely differs by zone, exactly as it
does for the code being read.

A file that is not text — a PNG, a zip — is not read and not reported;
it was never a candidate. It is counted in the summary so the coverage
is still stated. A file that IS text and could not be read, or is not
UTF-8, is named on stderr and carried in the report, and does not by
itself fail the run. --strict turns those back into a failure.

Exit codes follow grep: 0 dates found · 1 none found · 2 malformed
question. Finding none is an answer, not an error.`;

export const FLAGS: readonly string[] = Object.freeze([
	'--strict',
	'--tz',
	'--after',
	'--before',
	'--sort',
	'--dedupe',
	'--iso',
	'--format',
	'--year',
	'--date-order',
	'--kinds',
	'--values',
	'--stdin',
	'--hidden',
	'--no-ignore',
	'--help',
]);
