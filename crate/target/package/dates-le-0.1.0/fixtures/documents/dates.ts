// A date-constructor argument is a date even when the string alone
// would not look like one.
const written = new Date('March 5, 2024');
const parsed = Date.parse('2024-01-15T10:30:45Z');
const viaMoment = moment('2024-01-15');
const viaDayjs = dayjs('1/15/2024 10:30:45');
const viaLuxon = DateTime.fromISO('2024-06-01T00:00:00Z');

// Split across lines, which a per-line scan cannot see.
const wrapped = new Date(
	'January 15 2024',
);

// Not a date, and not emitted: the instant cannot be resolved.
const rejected = new Date('sometime next week');

// A bare literal is still found by the shared patterns.
const bare = '2024-12-31T23:59:59Z';
const seconds = 1705314645;
