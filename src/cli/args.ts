/**
 * The command line, parsed as the Rust CLI parses it: strictly, in order, and
 * refusing rather than defaulting. `--tz` is read first wherever it appears,
 * because `--after` and `--before` are dates too and must land in the same
 * zone as the documents.
 */
import zones from '../../crate/fixtures/zones.json';
import { resolveInstant } from '../extraction/extended';
import { DATE_KINDS, DEFAULT_KINDS } from '../extraction/kinds';
import { type DateOrder, isDateOrder } from '../extraction/regional';
import type { DateFormat } from '../types';
import { rustDebug } from './debug';
import { FLAGS } from './usage';

export interface ScanOptions {
	readonly format: string | null;
	readonly dedupe: boolean;
	readonly sort: boolean;
	readonly iso: boolean;
	readonly after: number | null;
	readonly before: number | null;
	/** The year a syslog line is read in, since the line carries none. */
	readonly year: number;
	readonly order: DateOrder;
	readonly kinds: readonly DateFormat[];
}

export interface WalkOptions {
	readonly hidden: boolean;
	readonly respectIgnore: boolean;
}

export interface Cli {
	readonly scan: ScanOptions;
	readonly walk: WalkOptions;
	readonly values: boolean;
	readonly strict: boolean;
	readonly stdin: boolean;
	readonly roots: readonly string[];
	/** The IANA zone zone-less dates resolve in, or null for this machine's. */
	readonly zone: string | null;
}

type Draft = { -readonly [K in keyof Cli]: Cli[K] };
type ScanDraft = { -readonly [K in keyof ScanOptions]: ScanOptions[K] };

/** chrono-tz's names, which the crate test holds equal to the crate's. */
const ZONES: ReadonlySet<string> = new Set(zones);

/**
 * The zone named by `--tz`, read before anything else. ICU would also take
 * `utc` and `+05:00`, and chrono-tz refuses both, so the name is checked
 * against chrono-tz's own list.
 */
function zoneFirst(args: readonly string[]): string | null {
	const index = args.indexOf('--tz');
	if (index === -1) return null;
	const raw = args[index + 1];
	if (raw === undefined) throw new Error('--tz needs a value');
	if (!ZONES.has(raw)) {
		throw new Error(`${rustDebug(raw)} is not an IANA timezone name`);
	}
	return raw;
}

/**
 * Applied to the process so `Date.parse`, which every date goes through,
 * reads zone-less dates in it. The crate sets its zone at the same point.
 */
export function applyZone(zone: string | null): void {
	if (zone !== null) process.env.TZ = zone;
}

export function parse(args: readonly string[], year: number): Cli {
	const zone = zoneFirst(args);
	applyZone(zone);
	const scan: ScanDraft = {
		format: null,
		dedupe: false,
		sort: false,
		iso: false,
		after: null,
		before: null,
		year,
		order: 'mdy',
		kinds: DEFAULT_KINDS,
	};
	const draft: Draft = {
		scan,
		walk: { hidden: false, respectIgnore: true },
		values: false,
		strict: false,
		stdin: false,
		roots: [],
		zone,
	};

	for (let index = 0; index < args.length; index++) {
		const arg = args[index] as string;
		const value = (name: string): string => {
			const next = args[index + 1];
			if (next === undefined) throw new Error(`${name} needs a value`);
			index += 1;
			return next;
		};
		// Already applied by `zoneFirst`. Its value is passed over unread, as
		// the crate does, even when a second `--tz` has none.
		if (arg === '--tz') {
			index += 1;
			continue;
		}
		const option = Object.hasOwn(OPTIONS, arg) ? OPTIONS[arg] : undefined;
		if (option) {
			option(draft, scan, value);
			continue;
		}
		if (arg.startsWith('--')) {
			throw new Error(
				`unknown option ${rustDebug(arg)} — one of: ${FLAGS.join(', ')}`,
			);
		}
		draft.roots = [...draft.roots, arg];
	}

	if (!draft.stdin && draft.roots.length === 0) {
		throw new Error('name a file or directory, or pass --stdin');
	}
	draft.scan = Object.freeze({ ...scan });
	return Object.freeze(draft);
}

type Option = (
	draft: Draft,
	scan: ScanDraft,
	value: (name: string) => string,
) => void;

const OPTIONS: Readonly<Record<string, Option>> = Object.freeze({
	'--after': (_draft, scan, value) => {
		scan.after = instant(value('--after'));
	},
	'--before': (_draft, scan, value) => {
		scan.before = instant(value('--before'));
	},
	'--format': (_draft, scan, value) => {
		scan.format = value('--format');
	},
	'--year': (_draft, scan, value) => {
		scan.year = rustYear(value('--year'));
	},
	'--date-order': (_draft, scan, value) => {
		const raw = value('--date-order');
		if (!isDateOrder(raw)) {
			throw new Error(`--date-order needs mdy or dmy, not ${rustDebug(raw)}`);
		}
		scan.order = raw;
	},
	'--kinds': (_draft, scan, value) => {
		const raw = value('--kinds');
		const kinds = raw.split(',').map((name) => rustTrim(name));
		if (!kinds.every((kind) => DATE_KINDS.includes(kind as DateFormat))) {
			throw new Error(
				`--kinds needs a comma-separated list of: ${DATE_KINDS.join(', ')}, not ${rustDebug(raw)}`,
			);
		}
		scan.kinds = kinds as DateFormat[];
	},
	'--sort': (_draft, scan) => {
		scan.sort = true;
	},
	'--dedupe': (_draft, scan) => {
		scan.dedupe = true;
	},
	'--iso': (_draft, scan) => {
		scan.iso = true;
	},
	'--values': (draft) => {
		draft.values = true;
	},
	'--strict': (draft) => {
		draft.strict = true;
	},
	'--stdin': (draft) => {
		draft.stdin = true;
	},
	'--hidden': (draft) => {
		draft.walk = { ...draft.walk, hidden: true };
	},
	'--no-ignore': (draft) => {
		draft.walk = { ...draft.walk, respectIgnore: false };
	},
});

/** A boundary, read by the same parser that reads the documents. */
export function instant(raw: string): number {
	const parsed = resolveInstant(raw);
	if (Number.isNaN(parsed)) {
		throw new Error(`${rustDebug(raw)} is not a date this can read`);
	}
	return parsed;
}

const I64_MIN = -(2n ** 63n);
const I64_MAX = 2n ** 63n - 1n;

/** `str::parse::<i64>`: an optional sign, then digits, and nothing else. */
function rustYear(raw: string): number {
	const refusal = new Error(`--year needs a year, not ${rustDebug(raw)}`);
	if (!/^[+-]?\d+$/.test(raw)) throw refusal;
	const parsed = BigInt(raw);
	if (parsed < I64_MIN || parsed > I64_MAX) throw refusal;
	return Number(parsed);
}

/** `str::trim`: Rust's whitespace, which takes U+0085 and leaves U+FEFF. */
function rustTrim(value: string): string {
	return value.replace(RUST_SPACE_EDGES, '');
}

const RUST_SPACE =
	'\\t\\n\\v\\f\\r \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const RUST_SPACE_EDGES = new RegExp(`^[${RUST_SPACE}]+|[${RUST_SPACE}]+$`, 'g');
