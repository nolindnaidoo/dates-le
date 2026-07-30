import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_resetMockState,
	_setConfig,
} from '../__mocks__/vscode';
import { getConfiguration } from '../config/config';
import { handleSafetyChecks } from './safety';

beforeEach(() => {
	_resetMockState();
});

describe('handleSafetyChecks', () => {
	it('proceeds for small documents', () => {
		const document = _createDocument({ content: 'a: 2024-01-15' });
		const result = handleSafetyChecks(document as never, getConfiguration());
		expect(result.proceed).toBe(true);
	});

	it('blocks documents over the size threshold', () => {
		_setConfig('dates-le.safety.fileSizeWarnBytes', 1000);
		const document = _createDocument({ content: 'x'.repeat(2000) });
		const result = handleSafetyChecks(document as never, getConfiguration());
		expect(result.proceed).toBe(false);
		expect(result.message).toContain('exceeds safety threshold');
	});

	it('respects the configured floor for the threshold', () => {
		// Values below the declared minimum clamp to the minimum (1000).
		_setConfig('dates-le.safety.fileSizeWarnBytes', 1);
		const document = _createDocument({ content: 'x'.repeat(500) });
		const result = handleSafetyChecks(document as never, getConfiguration());
		expect(result.proceed).toBe(true);
	});

	it('skips all checks when safety is disabled', () => {
		_setConfig('dates-le.safety.enabled', false);
		_setConfig('dates-le.safety.fileSizeWarnBytes', 1000);
		const document = _createDocument({ content: 'x'.repeat(2000) });
		const result = handleSafetyChecks(document as never, getConfiguration());
		expect(result.proceed).toBe(true);
	});
});
