import { describe, expect, it } from 'vitest';
import { sanitizeErrorMessage } from './errors';

describe('sanitizeErrorMessage', () => {
	it('redacts macOS user directories', () => {
		expect(sanitizeErrorMessage('ENOENT /Users/alice/project/a.json')).toBe(
			'ENOENT /Users/***/project/a.json',
		);
	});

	it('redacts Linux home directories', () => {
		expect(sanitizeErrorMessage('read /home/bob/data.csv failed')).toBe(
			'read /home/***/data.csv failed',
		);
	});

	it('redacts Windows user directories', () => {
		expect(sanitizeErrorMessage('open C:\\Users\\carol\\f.xml')).toBe(
			'open C:\\Users\\***\\f.xml',
		);
	});

	it('redacts credential-shaped fragments', () => {
		expect(sanitizeErrorMessage('auth failed: password=hunter2')).toBe(
			'auth failed: password=***',
		);
		expect(sanitizeErrorMessage('token: abc.def.ghi rejected')).toBe(
			'token=*** rejected',
		);
		expect(sanitizeErrorMessage('api key=sk-12345 invalid')).toBe(
			'api key=*** invalid',
		);
	});

	it('leaves ordinary messages untouched', () => {
		expect(sanitizeErrorMessage('No dates found')).toBe('No dates found');
	});
});
