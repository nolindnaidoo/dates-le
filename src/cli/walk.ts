/**
 * Turning what the caller named into the list of files to read, as the Rust
 * CLI's `walk.rs` does with ripgrep's `ignore` crate.
 *
 * A file named explicitly is always read. Hidden entries are passed over
 * unless asked for, a link below the root is never followed, and the list is
 * sorted the way Rust sorts a `PathBuf`, by component, so a report's lines are
 * in the same order from either binary.
 *
 * The crate's walk drops an entry it cannot read, a locked directory
 * included, without a word, and so does this one. `.ignore` files stay in
 * force under `--no-ignore`, because the crate never turns them off.
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

interface Walk {
	readonly options: WalkOptions;
	readonly repository: RepositoryRules | null;
	readonly files: string[];
}

/** Every file under `roots`, in a stable order. */
export function collect(
	roots: readonly string[],
	options: WalkOptions,
): readonly string[] {
	const files: string[] = [];
	for (const root of roots) {
		if (isFile(root)) {
			files.push(root);
			continue;
		}
		files.push(...walkDirectory(root, options));
	}
	return Object.freeze(sortAndDedupe(files));
}

function isFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

function walkDirectory(root: string, options: WalkOptions): readonly string[] {
	const absolute = resolve(root);
	const repoRoot = options.respectIgnore ? repositoryRoot(absolute) : null;
	const walk: Walk = {
		options,
		repository: repoRoot ? repositoryRules(repoRoot) : null,
		files: [],
	};
	visit(walk, root, absolute, parentRules(absolute, options));
	return walk.files;
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
	} catch {
		return;
	}
	const inRepository =
		walk.options.respectIgnore && repositoryRoot(absolute) !== null;
	const chain = [...inherited, rulesFor(absolute, inRepository)];
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
	if (isIgnored(absolute, isDir, chain, walk.repository)) return;
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
