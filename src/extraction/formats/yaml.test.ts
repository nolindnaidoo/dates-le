import { describe, expect } from 'vitest';
import { extractFromYaml } from './yaml';

describe('extractFromYaml', () => {
	test('extractFromYaml: should extract ISO dates from YAML', () => {
		const yaml = `
  createdAt: 2023-12-25T10:30:00Z
  updatedAt: 2024-01-01T00:00:00Z
  timestamp: 2023-06-15T14:45:30.000Z
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('2023-06-15T14:45:30.000Z');
		expect(result[2].format).toBe('iso');
	});

	test('extractFromYaml: should extract Unix timestamps from YAML', () => {
		const yaml = `
  timestamp: 1703508600
  created: 1672531200
  updated: 1703508600000
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('1703508600');
		expect(result[0].format).toBe('unix');
		expect(result[1].value).toBe('1672531200');
		expect(result[1].format).toBe('unix');
		expect(result[2].value).toBe('1703508600000');
		expect(result[2].format).toBe('unix');
	});

	test('extractFromYaml: should extract simple dates from YAML', () => {
		const yaml = `
  date: 2023-12-25
  birthday: 2023-01-01
  anniversary: 2023-06-15
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('2023-12-25');
		expect(result[0].format).toBe('simple');
		expect(result[1].value).toBe('2023-01-01');
		expect(result[1].format).toBe('simple');
		expect(result[2].value).toBe('2023-06-15');
		expect(result[2].format).toBe('simple');
	});

	test('extractFromYaml: should extract RFC 2822 dates from YAML', () => {
		const yaml = `
  emailDate: Mon, 25 Dec 2023 10:30:00 GMT
  received: Tue, 01 Jan 2024 00:00:00 GMT
  sent: Wed, 15 Jun 2023 12:45:30 GMT
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('Mon, 25 Dec 2023 10:30:00 GMT');
		expect(result[0].format).toBe('rfc2822');
		expect(result[1].value).toBe('Tue, 01 Jan 2024 00:00:00 GMT');
		expect(result[1].format).toBe('rfc2822');
		expect(result[2].value).toBe('Wed, 15 Jun 2023 12:45:30 GMT');
		expect(result[2].format).toBe('rfc2822');
	});

	test('extractFromYaml: should handle nested YAML objects', () => {
		const yaml = `
  user:
    profile:
      createdAt: 2023-12-25T10:30:00Z
      lastLogin: 2024-01-01T00:00:00Z
  metadata:
    timestamp: 1703508600
    date: 2023-12-25
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('1703508600');
		expect(result[2].format).toBe('unix');
		expect(result[3].value).toBe('2023-12-25');
		expect(result[3].format).toBe('simple');
	});

	test('extractFromYaml: should handle YAML arrays', () => {
		const yaml = `
  timestamps:
    - 1703508600
    - 1672531200
    - 1703508600000
  dates:
    - 2023-12-25
    - 2024-01-01
    - 2023-06-15
  isoDates:
    - 2023-12-25T10:30:00Z
    - 2024-01-01T00:00:00Z
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(8);
		// Unix timestamps
		expect(result[0].value).toBe('1703508600');
		expect(result[0].format).toBe('unix');
		expect(result[1].value).toBe('1672531200');
		expect(result[1].format).toBe('unix');
		expect(result[2].value).toBe('1703508600000');
		expect(result[2].format).toBe('unix');
		// Simple dates
		expect(result[3].value).toBe('2023-12-25');
		expect(result[3].format).toBe('simple');
		expect(result[4].value).toBe('2024-01-01');
		expect(result[4].format).toBe('simple');
		expect(result[5].value).toBe('2023-06-15');
		expect(result[5].format).toBe('simple');
		// ISO dates
		expect(result[6].value).toBe('2023-12-25T10:30:00Z');
		expect(result[6].format).toBe('iso');
		expect(result[7].value).toBe('2024-01-01T00:00:00Z');
		expect(result[7].format).toBe('iso');
	});

	test('extractFromYaml: should handle empty YAML', () => {
		const yaml = '';

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(0);
	});

	test('extractFromYaml: should handle malformed YAML gracefully', () => {
		const yaml = `
  createdAt: 2023-12-25T10:30:00Z
  invalid: not a date
  timestamp: 1703508600
    `;

		const result = extractFromYaml(yaml);

		// Should still extract valid dates even from malformed YAML
		expect(result.length).toBe(2);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('1703508600');
		expect(result[1].format).toBe('unix');
	});

	test('extractFromYaml: should handle large YAML files', () => {
		const dates = Array(100).fill('2023-12-25T10:30:00Z');
		const timestamps = Array(100).fill(1703508600);
		const yaml = `
  dates:
  ${dates.map((date) => `  - ${date}`).join('\n')}
  timestamps:
  ${timestamps.map((ts) => `  - ${ts}`).join('\n')}
    `;

		const result = extractFromYaml(yaml);

		// Deduplication: Same value on different lines but each unique line keeps one
		expect(result.length).toBe(200);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[100].value).toBe('1703508600');
		expect(result[100].format).toBe('unix');
	});

	test('extractFromYaml: should track positions correctly', () => {
		const yaml = `
  date1: 2023-12-25T10:30:00Z
  date2: 2024-01-01T00:00:00Z
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(2);
		expect(result[0].position.line).toBe(2);
		expect(result[0].position.column).toBe(10);
		expect(result[1].position.line).toBe(3);
		expect(result[1].position.column).toBe(10);
	});

	test('extractFromYaml: should handle mixed date formats', () => {
		const yaml = `
  iso: 2023-12-25T10:30:00Z
  rfc: Mon, 25 Dec 2023 10:30:00 GMT
  unix: 1703508600
  simple: 2023-12-25
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('Mon, 25 Dec 2023 10:30:00 GMT');
		expect(result[1].format).toBe('rfc2822');
		expect(result[2].value).toBe('1703508600');
		expect(result[2].format).toBe('unix');
		expect(result[3].value).toBe('2023-12-25');
		expect(result[3].format).toBe('simple');
	});

	test('extractFromYaml: should handle quoted values', () => {
		const yaml = `
  createdAt: "2023-12-25T10:30:00Z"
  updatedAt: '2024-01-01T00:00:00Z'
  timestamp: "1703508600"
  date: '2023-12-25'
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('1703508600');
		expect(result[2].format).toBe('unix');
		expect(result[3].value).toBe('2023-12-25');
		expect(result[3].format).toBe('simple');
	});

	test('extractFromYaml: should handle complex nested structures', () => {
		const yaml = `
  api:
    version: "1.0"
    endpoints:
      - name: "users"
        createdAt: 2023-12-25T10:30:00Z
        lastModified: 2024-01-01T00:00:00Z
      - name: "posts"
        createdAt: 2023-06-15T14:45:30Z
        lastModified: 2023-12-31T23:59:59Z
  metadata:
    timestamps:
      - 1703508600
      - 1672531200
    dates:
      - 2023-12-25
      - 2024-01-01
    `;

		const result = extractFromYaml(yaml);

		expect(result.length).toBe(8);
		// ISO dates
		expect(result[0].value).toBe('2023-12-25T10:30:00Z');
		expect(result[0].format).toBe('iso');
		expect(result[1].value).toBe('2024-01-01T00:00:00Z');
		expect(result[1].format).toBe('iso');
		expect(result[2].value).toBe('2023-06-15T14:45:30Z');
		expect(result[2].format).toBe('iso');
		expect(result[3].value).toBe('2023-12-31T23:59:59Z');
		expect(result[3].format).toBe('iso');
		// Unix timestamps
		expect(result[4].value).toBe('1703508600');
		expect(result[4].format).toBe('unix');
		expect(result[5].value).toBe('1672531200');
		expect(result[5].format).toBe('unix');
		// Simple dates
		expect(result[6].value).toBe('2023-12-25');
		expect(result[6].format).toBe('simple');
		expect(result[7].value).toBe('2024-01-01');
		expect(result[7].format).toBe('simple');
	});
});
