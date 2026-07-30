import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/config/**/*.ts', 'src/extraction/**/*.ts', 'src/utils/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.bench.ts',
        'test/**',
        'dist/**',
        'src/__mocks__/**',
        'src/types.ts',
        'src/extension.ts',
        'src/commands/**',
        'src/ui/**',
        'src/telemetry/**',
        '**/node_modules/**',
        '**/coverage/**',
        '**/release/**',
        '**/docs/**',
        '**/*.config.*',
      ],
    },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/release/**',
      '**/docs/**',
      '**/__mocks__/**',
      '**/test/**',
    ],
  },
  resolve: {
    alias: {
      vscode: '@vscode/test-electron',
    },
  },
})
