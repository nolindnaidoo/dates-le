// A release calendar. JavaScript rather than TypeScript on purpose:
// the two are read by exactly the same patterns and are two different
// `fileType` keys, and a format the schema advertises with no document
// behind it is a format the two frontends have never been compared on.
const cutover = new Date('March 5, 2024');
const opened = moment('15 Jan 2024 10:30:08 +0000');
const shipped = dayjs('2024-01-15T10:30:45Z');
const parsed = Date.parse('Mon, 15 Jan 2024 10:30:45 CEST');
const window = { from: '2024-01-15', to: '2024-02-29' };

// Constructor arguments split across lines, which a per-line scan misses.
const opening = new Date(
	'January 15 2024',
);

// Not dates: a nine-digit id is below the epoch floor, a syslog line is
// three words in a JavaScript file, and an issue number is a number.
const build = 999999999;
// Jan 15 10:30:47 shipped in #2024
const ratio = 1.2345678901234567;

export { build, cutover, opened, opening, parsed, ratio, shipped, window };
