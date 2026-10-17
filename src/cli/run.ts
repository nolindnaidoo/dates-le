/**
 * The terminal surface, as the Rust CLI's `cli.rs` runs it.
 *
 * stdout is protocol: one JSON report per line whenever something is reading
 * it, and nothing when it is a terminal, because the stderr listing already
 * shows every date a person reads there. `--values` prints the bare values
 * wherever stdout goes, and then stderr says nothing.
 */

import { existsSync } from 'node:fs';
import { resolveFormat } from '../mcp/fileType';
import { type Cli, parse } from './args';
import { decodeUtf8OrThrow, rustIoMessage, withoutBom } from './ioError';
import {
	describe,
	exitCode,
	type FileReport,
	scanText,
	scanWalked,
} from './scan';
import { USAGE } from './usage';
import { collect } from './walk';

export interface RunIo {
	readonly stdout: (text: string) => void;
	readonly stderr: (text: string) => void;
	readonly stdoutIsTerminal: boolean;
	readonly readStdin: () => Promise<Uint8Array>;
	readonly version: string;
	/** This year, read before `--tz` moves the zone, as the crate reads it. */
	readonly year: number;
}

/** What a run read: a report per text file, and how many were not text. */
interface Scanned {
	readonly reports: readonly FileReport[];
	readonly binary: number;
}

export async function run(args: readonly string[], io: RunIo): Promise<number> {
	if (args.includes('--version')) {
		io.stdout(`dates-le ${io.version}\n`);
		return 0;
	}
	if (args.length === 0 || args.includes('--help')) {
		io.stdout(`${USAGE}\n`);
		return 0;
	}

	let scanned: Scanned;
	let options: Cli;
	try {
		options = parse(args, io.year);
		scanned = await gather(options, io);
	} catch (error) {
		io.stderr(
			`dates-le: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		io.stderr('try `dates-le --help`\n');
		return 2;
	}

	report(scanned, options.values, io);
	return exitCode(scanned.reports, options.strict);
}

async function gather(options: Cli, io: RunIo): Promise<Scanned> {
	if (options.stdin) {
		// No file name to infer from, so an unnamed format falls back.
		const language = resolveFormat(options.scan.format ?? undefined, undefined);
		let content: string;
		try {
			content = decodeUtf8OrThrow(await io.readStdin());
		} catch (error) {
			throw new Error(`could not read stdin: ${rustIoMessage(error)}`);
		}
		return {
			reports: [
				await scanText('<stdin>', withoutBom(content), language, options.scan),
			],
			binary: 0,
		};
	}

	for (const root of options.roots) {
		if (!existsSync(root)) throw new Error(`${root} does not exist`);
	}
	return scanWalked(collect(options.roots, options.walk), options.scan);
}

function report(scanned: Scanned, values: boolean, io: RunIo): void {
	if (values) {
		const lines = scanned.reports.flatMap((each) =>
			each.dates.map((date) => `${date.value}\n`),
		);
		io.stdout(lines.join(''));
		return;
	}
	if (!io.stdoutIsTerminal) {
		io.stdout(
			scanned.reports.map((each) => `${JSON.stringify(each)}\n`).join(''),
		);
	}
	io.stderr(summary(scanned));
}

/** Every date, then the tally, then each file that was not read. */
export function summary(scanned: Scanned): string {
	const { reports, binary } = scanned;
	const lines = reports.flatMap((each) =>
		each.dates.map((date) => describe(each, date)),
	);
	const total = reports.reduce((sum, each) => sum + each.dates.length, 0);
	const unread = reports.filter((each) => each.skipped !== undefined);
	const files = reports.length - unread.length;
	const skipped = unread.length === 0 ? '' : `, ${unread.length} skipped`;
	const binaries =
		binary === 0 ? '' : `, ${binary} binary file${plural(binary)} skipped`;
	lines.push(
		`${total} date${plural(total)} in ${files} file${plural(files)}${skipped}${binaries}`,
	);
	for (const each of unread)
		lines.push(`  skipped ${each.file}: ${each.skipped}`);
	return `${lines.join('\n')}\n`;
}

function plural(count: number): string {
	return count === 1 ? '' : 's';
}
