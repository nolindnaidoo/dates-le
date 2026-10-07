import type { DateFormat } from '../types';

/**
 * The kinds of date this reads, by the name each carries as `format` in an
 * answer. `unknown` is never emitted, so it is not one.
 *
 * The extension's setting, the MCP tool's `kinds` argument and the crate's
 * `--kinds` flag all take these names, and all leave the same one out.
 */
export const DATE_KINDS: readonly DateFormat[] = Object.freeze([
	'iso',
	'simple',
	'local',
	'rfc2822',
	'utc',
	'week',
	'ordinal',
	'basic',
	'custom',
	'unix',
]);

/**
 * Every kind but the Unix time. A bare number is the one kind that does not
 * look like a date, and an id or a phone number of the same length reads as
 * one, so it is extracted only when asked for.
 */
export const DEFAULT_KINDS: readonly DateFormat[] = Object.freeze(
	DATE_KINDS.filter((kind) => kind !== 'unix'),
);

export function isDateKind(value: unknown): value is DateFormat {
	return DATE_KINDS.includes(value as DateFormat);
}
