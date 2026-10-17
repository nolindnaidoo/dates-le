/**
 * Turning what the caller named into the list of files to read, as the Rust
 * CLI's `walk.rs` does with ripgrep's `ignore` crate.
 *
 * A file named explicitly is always read. Hidden entries are passed over
 * unless asked for, a link below the root is never followed, and the list is
 * sorted the way Rust sorts a `PathBuf`, by component, so a report's lines are
 * in the same order from either binary.
 *
 * An entry the walk cannot enter, a locked directory, is reported with its
 * reason rather than dropped, and `--no-ignore` turns every ignore file off,
 * `.ignore` included, as the crate's walk does.
 */
import { type Dirent, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type { WalkOptions } from './args';
import {
	type DirectoryRules,
	isIgnored,
	type RepositoryRules,
	repositoryRoot,
	repositoryRules,
	rulesFor,
} from './ignoreRules';
import { rustIoMessage } from './ioError';

export interface Unreadable {
	readonly path: string;
	readonly reason: string;
}

/** The files to read, and the entries the walk could not enter. */
export interface Walked {
	readonly files: readonly string[];
	readonly unreadable: readonly Unreadable[];
}

interface Walk {
	readonly options: WalkOptions;
	readonly repository: RepositoryRules | null;
	readonly files: string[];
	readonly unreadable: Unreadable[];
}

/** Every file under `roots`, and every entry it could not enter, in a stable order. */
export function collect(
	roots: readonly string[],
	options: WalkOptions,
): Walked {
	const files: string[] = [];
	const unreadable: Unreadable[] = [];
	for (const root of roots) {
		if (isFile(root)) {
			files.push(root);
			continue;
		}
		const walk = walkDirectory(root, options);
		files.push(...walk.files);
		unreadable.push(...walk.unreadable);
	}
	return Object.freeze({
		files: sortAndDedupe(files),
		unreadable: sortAndDedupeUnreadable(unreadable),
	});
}

function isFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

function walkDirectory(root: string, options: WalkOptions): Walk {
	const absolute = resolve(root);
	const repoRoot = options.respectIgnore ? repositoryRoot(absolute) : null;
	const walk: Walk = {
		options,
		repository: repoRoot ? repositoryRules(repoRoot) : null,
		files: [],
		unreadable: [],
	};
	visit(walk, root, absolute, parentRules(absolute, options));
	return walk;
}

/** The crate's `parents(true)`: ignore files above the walk root count too. */
function parentRules(
	absolute: string,
	options: WalkOptions,
): readonly DirectoryRules[] {
	if (!options.respectIgnore) return [];
	const chain: DirectoryRules[] = [];
	let dir = dirname(absolute);
	while (dir !== dirname(dir)) {
		chain.unshift(rulesFor(dir, repositoryRoot(dir) !== null));
		dir = dirname(dir);
	}
	chain.unshift(rulesFor(dir, repositoryRoot(dir) !== null));
	return chain;
}

function visit(
	walk: Walk,
	shown: string,
	absolute: string,
	inherited: readonly DirectoryRules[],
): void {
	let entries: readonly Dirent[];
	try {
		entries = readdirSync(absolute, { withFileTypes: true });
	} catch (error) {
		// The path the `ignore` error carries, and the walkdir error inside it.
		walk.unreadable.push({
			path: shown,
			reason: `IO error for operation on ${shown}: ${rustIoMessage(error)}`,
		});
		return;
	}
	const chain = walk.options.respectIgnore
		? [...inherited, rulesFor(absolute, repositoryRoot(absolute) !== null)]
		: inherited;
	for (const entry of entries) {
		visitEntry(
			walk,
			entry,
			joinShown(shown, entry.name),
			`${absolute}${sep}${entry.name}`,
			chain,
		);
	}
}

function visitEntry(
	walk: Walk,
	entry: Dirent,
	shown: string,
	absolute: string,
	chain: readonly DirectoryRules[],
): void {
	if (!walk.options.hidden && entry.name.startsWith('.')) return;
	const isDir = entry.isDirectory();
	if (!isDir && !entry.isFile()) return;
	if (
		walk.options.respectIgnore &&
		isIgnored(absolute, isDir, chain, walk.repository)
	)
		return;
	if (!isDir) {
		walk.files.push(shown);
		return;
	}
	visit(walk, shown, absolute, chain);
}

/** `PathBuf::join`: no separator is added after one that is already there. */
function joinShown(parent: string, name: string): string {
	if (parent.endsWith('/') || parent.endsWith(sep)) return `${parent}${name}`;
	return `${parent}${sep}${name}`;
}

type Component = readonly [rank: number, bytes: Buffer];

/**
 * A path as Rust compares it: by component, where `/` and `.` sort before a
 * name and a name compares by its bytes. Comparing the strings instead would
 * put `a.md` before `a/b.md`, because `.` is below `/` in ASCII.
 */
function components(path: string): readonly Component[] {
	const separators = sep === '\\' ? /[\\/]/ : /\//;
	const parts = path.split(separators);
	const found: Component[] = [];
	if (parts[0] === '' && parts.length > 1) found.push([1, Buffer.alloc(0)]);
	parts.forEach((part, index) => {
		if (!part) return;
		if (part === '.') {
			if (index === 0) found.push([2, Buffer.alloc(0)]);
			return;
		}
		found.push([part === '..' ? 3 : 4, Buffer.from(part)]);
	});
	return found;
}

function compareComponents(
	left: readonly Component[],
	right: readonly Component[],
): number {
	const shared = Math.min(left.length, right.length);
	for (let index = 0; index < shared; index++) {
		const [leftRank, leftBytes] = left[index] as Component;
		const [rightRank, rightBytes] = right[index] as Component;
		if (leftRank !== rightRank) return leftRank - rightRank;
		const order = Buffer.compare(leftBytes, rightBytes);
		if (order !== 0) return order;
	}
	return left.length - right.length;
}

/** The crate's sort, then `Vec::dedup`, which compares paths by component. */
function sortAndDedupe(files: readonly string[]): string[] {
	const keyed = files.map((path) => ({ path, key: components(path) }));
	keyed.sort((left, right) => compareComponents(left.key, right.key));
	return keyed
		.filter((item, index) => {
			const previous = keyed[index - 1];
			return !previous || compareComponents(previous.key, item.key) !== 0;
		})
		.map((item) => item.path);
}

/** `Vec<(PathBuf, String)>::sort` then `dedup`: by path, then by reason. */
function sortAndDedupeUnreadable(entries: readonly Unreadable[]): Unreadable[] {
	const keyed = entries.map((entry) => ({
		entry,
		key: components(entry.path),
	}));
	const order = (
		left: (typeof keyed)[number],
		right: (typeof keyed)[number],
	): number =>
		compareComponents(left.key, right.key) ||
		Buffer.compare(
			Buffer.from(left.entry.reason),
			Buffer.from(right.entry.reason),
		);
	keyed.sort(order);
	return keyed
		.filter((item, index) => {
			const previous = keyed[index - 1];
			return !previous || order(previous, item) !== 0;
		})
		.map((item) => item.entry);
}
