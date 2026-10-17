/**
 * Reading files and shaping the report, as the Rust CLI's `scan.rs` does.
 *
 * One report per file. Every field in it is either something the extension
 * also reports or something a flag explicitly asked for.
 */
import { readFileSync } from 'node:fs';
import { basename, sep } from 'node:path';
import { extractDates } from '../extraction/extract';
import { resolveFormat } from '../mcp/fileType';
import type { ScanOptions } from './args';
import { decodeUtf8OrThrow, rustIoMessage, withoutBom } from './ioError';

export interface FoundDate {
	readonly value: string;
	readonly format: string;
	readonly timestamp: number;
	readonly line: number;
	readonly column: number;
	/** The instant as a UTC ISO string, when `--iso` asked for it. */
	readonly iso?: string;
}

export interface FileReport {
	readonly file: string;
	readonly fileType: string;
	readonly dates: readonly FoundDate[];
	/** Why this file was not read, when it was not. */
	readonly skipped?: string;
}

export async function scanText(
	label: string,
	content: string,
	language: string,
	options: ScanOptions,
): Promise<FileReport> {
	const result = await extractDates(
		content,
		language,
		options.order,
		undefined,
		options.year,
	);
	const found: FoundDate[] = [];
	for (const date of result.dates) {
		if (date.timestamp === undefined || date.position === undefined) continue;
		found.push({
			value: date.value,
			format: date.format,
			timestamp: date.timestamp,
			line: date.position.line,
			column: date.position.column,
		});
	}
	return Object.freeze({
		file: label,
		fileType: language,
		dates: Object.freeze(shape(found, options)),
	});
}

/**
 * A file's report, or null when it is not text at all. A PNG was never a
 * candidate, so it is counted in the summary rather than reported, and it
 * does not fail `--strict`. A text file that could not be read is reported
 * with the reason.
 */
export async function scanFile(
	path: string,
	options: ScanOptions,
): Promise<FileReport | null> {
	const label = reportedPath(path);
	const language = resolveFormat(options.format ?? undefined, basename(path));
	let bytes: Buffer;
	try {
		bytes = readFileSync(path);
	} catch (error) {
		return skipped(label, rustIoMessage(error));
	}
	if (isBinary(bytes)) return null;
	let content: string;
	try {
		content = decodeUtf8OrThrow(bytes);
	} catch {
		return skipped(label, 'not UTF-8 text');
	}
	return scanText(label, withoutBom(content), language, options);
}

function skipped(file: string, reason: string): FileReport {
	return Object.freeze({
		file,
		fileType: '',
		dates: Object.freeze([]),
		skipped: reason,
	});
}

/** `/` on every platform, as the crate spells a path in its report. */
export function reportedPath(path: string): string {
	return sep === '/' ? path : path.split(sep).join('/');
}

/** ripgrep's heuristic: a NUL byte in the first 8 KiB means binary. */
function isBinary(bytes: Uint8Array): boolean {
	return bytes.subarray(0, 8192).includes(0);
}

/** Filter, then dedupe, then sort, the order in which the flags compose. */
function shape(found: readonly FoundDate[], options: ScanOptions): FoundDate[] {
	const kept = found
		.filter((date) => options.kinds.includes(date.format as never))
		.filter((date) => options.after === null || date.timestamp >= options.after)
		.filter(
			(date) => options.before === null || date.timestamp < options.before,
		)
		.map((date) => withIso(date, options.iso));
	const deduped = options.dedupe
		? kept.filter(
				(date, index) =>
					kept.findIndex((other) => other.value === date.value) === index,
			)
		: kept;
	if (!options.sort) return deduped;
	return [...deduped].sort((left, right) => left.timestamp - right.timestamp);
}

function withIso(date: FoundDate, iso: boolean): FoundDate {
	if (!iso) return Object.freeze(date);
	const rendered = toIso(date.timestamp);
	return Object.freeze(rendered === null ? date : { ...date, iso: rendered });
}

/** chrono's range, outside which the crate renders no ISO string. */
const CHRONO_MIN_MS = Date.UTC(-262143, 0, 1);
const CHRONO_MAX_MS = Date.UTC(262142, 11, 31, 23, 59, 59, 999);

/**
 * The crate's `%Y-%m-%dT%H:%M:%SZ`, with `.%3f` only when there are
 * milliseconds. chrono signs a year outside 0..=9999 and pads it to four
 * digits, where `toISOString` writes six.
 */
export function toIso(timestamp: number): string | null {
	if (timestamp < CHRONO_MIN_MS || timestamp > CHRONO_MAX_MS) return null;
	const moment = new Date(timestamp);
	const year = moment.getUTCFullYear();
	const shownYear =
		year < 0 ? `-${pad(-year, 4)}` : year > 9999 ? `+${year}` : pad(year, 4);
	const clock = `${pad(moment.getUTCHours(), 2)}:${pad(moment.getUTCMinutes(), 2)}:${pad(moment.getUTCSeconds(), 2)}`;
	const millis = moment.getUTCMilliseconds();
	const fraction = millis === 0 ? '' : `.${pad(millis, 3)}`;
	return `${shownYear}-${pad(moment.getUTCMonth() + 1, 2)}-${pad(moment.getUTCDate(), 2)}T${clock}${fraction}Z`;
}

function pad(value: number, width: number): string {
	return String(value).padStart(width, '0');
}

/** grep's convention, with an unread text file failing only `--strict`. */
export function exitCode(
	reports: readonly FileReport[],
	strict: boolean,
): number {
	if (strict && reports.some((report) => report.skipped !== undefined))
		return 2;
	if (reports.some((report) => report.dates.length > 0)) return 0;
	return 1;
}

/** The one-line projection of a date. It says what the JSON says, no more. */
export function describe(report: FileReport, date: FoundDate): string {
	const iso = date.iso === undefined ? '' : `  ${date.iso}`;
	return `${report.file}:${date.line}:${date.column}  ${date.value}  [${date.format}]${iso}`;
}
