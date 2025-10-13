import { describe, expect } from 'vitest';
import { extractFromCsv } from './csv';

describe('extractFromCsv', () => {
	test('extractFromCsv: should extract ISO dates from CSV', () => {
		const csv = `
  name,createdAt,updatedAt
  user1,2023-12-25T10:30:00Z,2024-01-01T00:00:00Z
  user2,2023-06-15T14:45:30.000Z,2023-12-31T23:59:59Z
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('2023-06-15T14:45:30.000Z');
		expect(result[2].format).toBe('iso');
		expect(result[3].value).toBe('2023-12-31T23:59:59Z');
		expect(result[3].format).toBe('iso');
	});

	test('extractFromCsv: should extract Unix timestamps from CSV', () => {
		const csv = `
  id,timestamp,created,updated
  1,1703508600,1672531200,1703508600000
  2,1672531200,1703508600,1703508600000
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(6);
		expect(result[0].value).toBe('1703508600');
		expect(result[0].format).toBe('unix');
		expect(result[1].value).toBe('1672531200');
		expect(result[1].format).toBe('unix');
		expect(result[2].value).toBe('1703508600000');
		expect(result[2].format).toBe('unix');
		expect(result[3].value).toBe('1672531200');
		expect(result[3].format).toBe('unix');
		expect(result[4].value).toBe('1703508600');
		expect(result[4].format).toBe('unix');
		expect(result[5].value).toBe('1703508600000');
		expect(result[5].format).toBe('unix');
	});

	test('extractFromCsv: should extract simple dates from CSV', () => {
		const csv = `
  name,birthday,anniversary,date
  user1,2023-12-25,2023-01-01,2023-06-15
  user2,2023-01-01,2023-12-25,2023-06-15
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(6);
		expect(result[0].value).toBe('2023-12-25');
		expect(result[0].format).toBe('simple');
		expect(result[1].value).toBe('2023-01-01');
		expect(result[1].format).toBe('simple');
		expect(result[2].value).toBe('2023-06-15');
		expect(result[2].format).toBe('simple');
		expect(result[3].value).toBe('2023-01-01');
		expect(result[3].format).toBe('simple');
		expect(result[4].value).toBe('2023-12-25');
		expect(result[4].format).toBe('simple');
		expect(result[5].value).toBe('2023-06-15');
		expect(result[5].format).toBe('simple');
	});

	test('extractFromCsv: should extract RFC 2822 dates from CSV', () => {
		const csv = `
  id,emailDate,received,sent
  1,Mon, 25 Dec 2023 10:30:00 GMT,Tue, 01 Jan 2024 00:00:00 GMT,Wed, 15 Jun 2023 12:45:30 GMT
  2,Tue, 01 Jan 2024 00:00:00 GMT,Wed, 15 Jun 2023 12:45:30 GMT,Mon, 25 Dec 2023 10:30:00 GMT
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(6);
		expect(result[0].value).toBe('Mon, 25 Dec 2023 10:30:00 GMT');
		expect(result[0].format).toBe('rfc2822');
		expect(result[1].value).toBe('Tue, 01 Jan 2024 00:00:00 GMT');
		expect(result[1].format).toBe('rfc2822');
		expect(result[2].value).toBe('Wed, 15 Jun 2023 12:45:30 GMT');
		expect(result[2].format).toBe('rfc2822');
		expect(result[3].value).toBe('Tue, 01 Jan 2024 00:00:00 GMT');
		expect(result[3].format).toBe('rfc2822');
		expect(result[4].value).toBe('Wed, 15 Jun 2023 12:45:30 GMT');
		expect(result[4].format).toBe('rfc2822');
		expect(result[5].value).toBe('Mon, 25 Dec 2023 10:30:00 GMT');
		expect(result[5].format).toBe('rfc2822');
	});

	test('extractFromCsv: should handle CSV with headers', () => {
		const csv = `
  name,createdAt,updatedAt
  user1,2023-12-25T10:30:00Z,2024-01-01T00:00:00Z
  user2,2023-06-15T14:45:30Z,2023-12-31T23:59:59Z
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('2023-06-15T14:45:30Z');
		expect(result[2].format).toBe('iso');
		expect(result[3].value).toBe('2023-12-31T23:59:59Z');
		expect(result[3].format).toBe('iso');
	});

	test('extractFromCsv: should handle CSV without headers', () => {
		const csv = `
  user1,2023-12-25T10:30:00Z,2024-01-01T00:00:00Z
  user2,2023-06-15T14:45:30Z,2023-12-31T23:59:59Z
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('2023-06-15T14:45:30Z');
		expect(result[2].format).toBe('iso');
		expect(result[3].value).toBe('2023-12-31T23:59:59Z');
		expect(result[3].format).toBe('iso');
	});

	test('extractFromCsv: should handle quoted values', () => {
		const csv = `
  name,createdAt,updatedAt
  "user1","2023-12-25T10:30:00Z","2024-01-01T00:00:00Z"
  "user2","2023-06-15T14:45:30Z","2023-12-31T23:59:59Z"
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('2023-06-15T14:45:30Z');
		expect(result[2].format).toBe('iso');
		expect(result[3].value).toBe('2023-12-31T23:59:59Z');
		expect(result[3].format).toBe('iso');
	});

	test('extractFromCsv: should handle empty CSV', () => {
		const csv = '';

		const result = extractFromCsv(csv);

		expect(result.length).toBe(0);
	});

	test('extractFromCsv: should handle CSV with only headers', () => {
		const csv = 'name,createdAt,updatedAt';

		const result = extractFromCsv(csv);

		expect(result.length).toBe(0);
	});

	test('extractFromCsv: should handle malformed CSV gracefully', () => {
		const csv = `
  name,createdAt,updatedAt
  user1,2023-12-25T10:30:00Z,2024-01-01T00:00:00Z
  user2,invalid-date,2023-12-31T23:59:59Z
  user3,2023-06-15T14:45:30Z
    `;

		const result = extractFromCsv(csv);

		// Should still extract valid dates even from malformed CSV
		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('2023-12-31T23:59:59Z');
		expect(result[2].format).toBe('iso');
		expect(result[3].value).toBe('2023-06-15T14:45:30Z');
		expect(result[3].format).toBe('iso');
	});

	test('extractFromCsv: should handle large CSV files', () => {
		const rows = Array(100).fill(
			'user,2023-12-25T10:30:00Z,2024-01-01T00:00:00Z',
		);
		const csv = `name,createdAt,updatedAt\n${rows.join('\n')}`;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(200);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
	});

	test('extractFromCsv: should track positions correctly', () => {
		const csv = `
  name,createdAt,updatedAt
  user1,2023-12-25T10:30:00Z,2024-01-01T00:00:00Z
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(2);
		expect(result[0].position.line).toBe(3);
		expect(result[0].position.column).toBe(9);
		expect(result[1].position.line).toBe(3);
		expect(result[1].position.column).toBe(30);
	});

	test('extractFromCsv: should handle mixed date formats', () => {
		const csv = `
  name,iso,rfc,unix,simple
  user1,2023-12-25T10:30:00Z,Mon, 25 Dec 2023 10:30:00 GMT,1703508600,2023-12-25
  user2,2024-01-01T00:00:00Z,Tue, 01 Jan 2024 00:00:00 GMT,1672531200,2024-01-01
    `;

		const result = extractFromCsv(csv);

		// Deduplication: Simple dates within ISO dates on same line are filtered out
		expect(result.length).toBe(6);
		// ISO dates
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[3].value).toBe('2024-01-01T00:00:00Z');
		expect(result[3].format).toBe('iso');
		// RFC dates
		expect(result[1].value).toBe('Mon, 25 Dec 2023 10:30:00 GMT');
		expect(result[1].format).toBe('rfc2822');
		expect(result[4].value).toBe('Tue, 01 Jan 2024 00:00:00 GMT');
		expect(result[4].format).toBe('rfc2822');
		// Unix timestamps
		expect(result[2].value).toBe('1703508600');
		expect(result[2].format).toBe('unix');
		expect(result[5].value).toBe('1672531200');
		expect(result[5].format).toBe('unix');
		// Note: Simple dates (2023-12-25, 2024-01-01) are filtered out by deduplication
		// because they're substrings of ISO dates on the same line
	});

	test('extractFromCsv: should handle different delimiters', () => {
		const csv = `
  name;createdAt;updatedAt
  user1;2023-12-25T10:30:00Z;2024-01-01T00:00:00Z
  user2;2023-06-15T14:45:30Z;2023-12-31T23:59:59Z
    `;

		const result = extractFromCsv(csv);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('2023-06-15T14:45:30Z');
		expect(result[2].format).toBe('iso');
		expect(result[3].value).toBe('2023-12-31T23:59:59Z');
		expect(result[3].format).toBe('iso');
	});
});
