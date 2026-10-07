import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractDatesFromText } from '../extraction/extract';
import { resolveFormat } from '../mcp/fileType';
import {
	listFiles,
	type ScanLimits,
	type ScanSummary,
	scanFiles,
	unreadNotes,
} from '../workspace/scan';
import {
	askForFolder,
	code,
	deliver,
	hasSomethingToScan,
	limitsFrom,
	type WorkspaceDeps,
} from './workspaceShared';

/** One place a date is written, and how it is spelled there. */
export interface Occurrence {
	readonly file: string;
	readonly written: string;
	readonly position:
		| { readonly line: number; readonly column: number }
		| undefined;
}

/** One date, however it is spelled, and every place it was found. */
export interface DistinctDate {
	/** The date as the report names it. Two spellings with one label are one date. */
	readonly label: string;
	/** Epoch milliseconds of the first spelling found, for putting dates in order. */
	readonly order: number;
	readonly occurrences: readonly Occurrence[];
}

const HAS_TIME = /\d{1,2}:\d{2}/;
/** A zone after a time: `Z`, an offset, or a zone name. */
const HAS_ZONE =
	/\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2}|[A-Z]{2,5})\b/;
const ALL_DIGITS = /^\d+$/;

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

/**
 * What a written date is called in the report, and so which spellings are
 * the same date.
 *
 * A date written with a zone, or as a Unix time, is a moment: it is named
 * in UTC. One written without a zone is a reading on a calendar and a clock,
 * and the moment it was resolved to depends on the machine that read it. So
 * it is named by what was written, `2024-01-15` or `2024-01-15T10:30:00`,
 * and `January 15, 2024` is the same date as `2024-01-15` on every machine.
 */
export function calendarLabel(written: string, timestamp: number): string {
	const moment = new Date(timestamp);
	const iso = moment.toISOString();
	if (ALL_DIGITS.test(written) || HAS_ZONE.test(written)) {
		return iso.endsWith('T00:00:00.000Z')
			? iso.slice(0, 10)
			: iso.replace(/\.000Z$/, 'Z');
	}
	// A date alone is resolved to midnight, in UTC by some readers and in
	// local time by others. Whichever midnight it is gives the day.
	if (!HAS_TIME.test(written) && iso.endsWith('T00:00:00.000Z'))
		return iso.slice(0, 10);
	const day = `${String(moment.getFullYear()).padStart(4, '0')}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
	return HAS_TIME.test(written)
		? `${day}T${pad(moment.getHours())}:${pad(moment.getMinutes())}:${pad(moment.getSeconds())}`
		: day;
}

export function registerExtractWorkspaceCommands(
	context: vscode.ExtensionContext,
	deps: WorkspaceDeps,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('dates-le.extractWorkspace', async () =>
			extractWorkspace(deps),
		),
		// The Explorer hands over the folder that was clicked. From the
		// palette there is none, and the command asks.
		vscode.commands.registerCommand(
			'dates-le.extractFolder',
			async (picked?: vscode.Uri) => {
				const folder = picked ?? (await askForFolder());
				if (folder !== undefined) await extractWorkspace(deps, folder);
			},
		),
	);
}

/**
 * Extract every date in every file under a folder, or in the whole
 * workspace when no folder is given.
 *
 * The answer is the project's dates in time order: each date once, however
 * it is spelled, with the spellings and the places. Files are read
 * from disk, so an unsaved edit is not seen.
 */
async function extractWorkspace(
	deps: WorkspaceDeps,
	root?: vscode.Uri,
): Promise<void> {
	deps.telemetry.event(
		root === undefined ? 'command-extract-workspace' : 'command-extract-folder',
	);
	if (!hasSomethingToScan(root, deps)) return;
	const config = getConfiguration();
	const limits = limitsFrom(config);

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: vscode.l10n.t('Scanning files...'),
			cancellable: true,
		},
		async (progress, token) => {
			const { files, fileLimitReached, ignored } = await listFiles(
				root,
				limits,
			);
			// Keyed by what the report calls the date, so `2024-01-15` and
			// `January 15, 2024` are one.
			const found = new Map<
				string,
				{ order: number; occurrences: Occurrence[] }
			>();
			let total = 0;
			const scanned = await scanFiles(
				root,
				files,
				limits,
				token,
				(done, all) =>
					progress.report({
						message: vscode.l10n.t('{0} of {1} files', done, all),
					}),
				({ file, text }) => {
					for (const date of extractDatesFromText(
						text,
						resolveFormat(undefined, file),
						config.dateOrder,
						config.kinds,
					)) {
						if (total >= config.workspaceScanMaxResults) return false;
						const occurrence = {
							file,
							written: date.value,
							position: date.position,
						};
						// The engine emits no date it could not resolve.
						const order = date.timestamp ?? Number.POSITIVE_INFINITY;
						const key =
							date.timestamp === undefined
								? date.value
								: calendarLabel(date.value, date.timestamp);
						const where = found.get(key);
						if (where === undefined)
							found.set(key, { order, occurrences: [occurrence] });
						else where.occurrences.push(occurrence);
						total++;
					}
					return total < config.workspaceScanMaxResults;
				},
			);
			// A cancelled scan read part of the tree. Reporting that as the
			// project's dates would understate it without saying so.
			if (scanned.cancelled) return;
			const summary: ScanSummary = { ...scanned, fileLimitReached, ignored };

			const dates = inTimeOrder(found);
			const where =
				root === undefined
					? undefined
					: vscode.workspace.asRelativePath(root, false);
			await deliver(
				(positions) =>
					formatExtractWorkspaceReport({
						where,
						dates,
						summary,
						limits,
						positions,
					}),
				config,
				deps,
			);

			deps.telemetry.event('extract-workspace-completed', {
				files: summary.read,
				dates: dates.length,
				occurrences: total,
			});
			deps.notifier.showInfo(headline(dates));
		},
	);
}

/**
 * Earliest first, then by label.
 *
 * A plain comparison rather than `localeCompare`: the order must not change
 * with the editor's display language.
 */
function inTimeOrder(
	found: ReadonlyMap<string, { order: number; occurrences: Occurrence[] }>,
): DistinctDate[] {
	return [...found]
		.map(([label, { order, occurrences }]) => ({ label, order, occurrences }))
		.sort(
			(a, b) =>
				a.order - b.order ||
				(a.label < b.label ? -1 : Number(a.label > b.label)),
		);
}

function filesOf(occurrences: readonly Occurrence[]): string[] {
	return [...new Set(occurrences.map((occurrence) => occurrence.file))];
}

/** The spellings of one date, the most used first. */
function spellings(occurrences: readonly Occurrence[]): string[] {
	const counts = new Map<string, number>();
	for (const { written } of occurrences)
		counts.set(written, (counts.get(written) ?? 0) + 1);
	return [...counts]
		.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : Number(a[0] > b[0])))
		.map(([written]) => written);
}

function headline(dates: readonly DistinctDate[]): string {
	const occurrences = dates.flatMap((date) => date.occurrences);
	return vscode.l10n.t(
		'{0} distinct date(s), {1} occurrence(s) in {2} file(s)',
		dates.length,
		occurrences.length,
		filesOf(occurrences).length,
	);
}

/** A file and the places in it, or how many times when positions are off. */
function placed(
	file: string,
	here: readonly Occurrence[],
	positions: boolean,
): string {
	const places = here.flatMap((o) =>
		o.position === undefined
			? []
			: [`**${o.position.line}:${o.position.column}**`],
	);
	if (positions && places.length > 0)
		return `${code(file)} · ${places.join(', ')}`;
	return here.length > 1 ? `${code(file)} (${here.length})` : code(file);
}

export interface ExtractWorkspaceReportInput {
	/** The folder that was scanned, or undefined for the whole workspace. */
	readonly where: string | undefined;
	readonly dates: readonly DistinctDate[];
	readonly summary: ScanSummary;
	readonly limits: ScanLimits;
	readonly positions?: boolean;
}

/**
 * The report for a folder or a workspace: a table of the distinct dates in
 * time order, with how each is spelled, how often and in how many files,
 * then where each repeated one is, and last whatever the scan left unread.
 */
export function formatExtractWorkspaceReport({
	where,
	dates,
	summary,
	limits,
	positions = true,
}: ExtractWorkspaceReportInput): string {
	const lines: string[] = [
		`# ${vscode.l10n.t('{0} workspace report', 'Dates-LE')}`,
		'',
	];
	const scope = where === undefined ? '' : `${code(where)} · `;
	lines.push(
		`${scope}${vscode.l10n.t('{0} file(s) read', summary.read)} · ${headline(dates)}`,
		'',
	);
	if (dates.length === 0) lines.push(vscode.l10n.t('No dates found.'), '');

	if (dates.length > 0) {
		lines.push(
			`| ${vscode.l10n.t('Date')} | ${vscode.l10n.t('Written as')} | ${vscode.l10n.t('Occurrences')} | ${vscode.l10n.t('Files')} | ${vscode.l10n.t('Where')} |`,
			'|---|---|---|---|---|',
		);
		// Most dates in a project are written once. Such a one is placed in
		// its row, so the sections below are only the repeated ones.
		for (const date of dates) {
			const row = `| ${cell(date.label)} | ${spellings(date.occurrences).map(cell).join(', ')} | ${date.occurrences.length} | ${filesOf(date.occurrences).length} |`;
			const only =
				date.occurrences.length === 1 ? date.occurrences[0] : undefined;
			lines.push(
				only === undefined
					? `${row} |`
					: `${row} ${placed(only.file, [only], positions)} |`,
			);
		}
		lines.push('');
	}

	for (const date of dates) {
		if (date.occurrences.length === 1) continue;
		lines.push(`## ${code(date.label)} (${date.occurrences.length})`, '');
		// One line per file, with every place in it.
		for (const file of filesOf(date.occurrences))
			lines.push(
				`- ${placed(
					file,
					date.occurrences.filter((o) => o.file === file),
					positions,
				)}`,
			);
		lines.push('');
	}

	const notes = unreadNotes(summary, limits, code('dates-le.workspace.*'));
	if (notes.length > 0) lines.push(...notes.map((note) => `> ${note}`), '');
	return lines.join('\n');
}

/** A code span that is safe inside a table cell. */
function cell(text: string): string {
	return code(text).replace(/\|/g, '\\|');
}
