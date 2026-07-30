const created = new Date('2024-01-15T10:30:00Z');
const parsedAt = Date.parse('2024-02-01');
const viaMoment = moment('2024-03-15');
const viaDayjs = dayjs('2024-04-01T00:00:00.000Z');
const viaLuxon = DateTime.fromISO('2024-05-20T14:30:00+02:00');
const multiline = new Date(
	'2024-06-15T10:30:00Z',
);
const epochSeconds = 1705312200;
const maxSafe = 9007199254740991;
// released 2024-07-04 per the roadmap
