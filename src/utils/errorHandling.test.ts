import { describe, expect, it } from 'vitest';
import { createEnhancedError } from './errorHandling';

describe('Error Handling', () => {
	it('should create enhanced error with correct properties', () => {
		const originalError = new Error('Test error');
		const enhancedError = createEnhancedError(
			originalError,
			'parse',
			'test context',
		);

		expect(enhancedError.category).toBe('parse');
		expect(enhancedError.message).toBe('Test error');
		expect(enhancedError.originalError).toBe(originalError);
		expect(enhancedError.recoverable).toBe(true);
	});
});
