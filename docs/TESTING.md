# Dates-LE Testing Guide

## Framework

Vitest with V8 coverage provider. Target 80% minimum coverage across all metrics.

### Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      threshold: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 },
      },
    },
  },
})
```

## Test Organization

```
src/
├── commands/
│   └── extract.test.ts       # Command integration tests
├── extraction/
│   ├── extract.test.ts       # Core extraction tests
│   └── formats/
│       ├── log.test.ts       # Format-specific tests
│       └── json.test.ts
└── utils/
    ├── errorHandling.test.ts # Utility tests
    └── performance.test.ts
```

## Test Categories

### Unit Tests

Pure function validation:

```typescript
describe('Date Extraction', () => {
  it('extracts ISO 8601 dates', () => {
    const content = '2023-12-25T10:30:00.000Z'
    const result = extractDates(content, 'log')

    expect(result.success).toBe(true)
    expect(result.dates).toHaveLength(1)
    expect(result.dates[0].value).toBe('2023-12-25T10:30:00.000Z')
  })

  it('extracts Unix timestamps', () => {
    const content = '1703508600'
    const result = extractDates(content, 'log')

    expect(result.success).toBe(true)
    expect(result.dates).toHaveLength(1)
  })

  it('handles invalid dates gracefully', () => {
    const content = 'not-a-date'
    const result = extractDates(content, 'log')

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
  })
})
```

### Integration Tests

Workflow validation:

```typescript
describe('Complete Workflow', () => {
  it('completes extract → convert → analyze', async () => {
    // Extract
    const extractResult = await extractDates(sampleLog, 'log')
    expect(extractResult.success).toBe(true)

    // Convert
    const convertResult = await convertDates(extractResult.dates, 'iso8601')
    expect(convertResult.success).toBe(true)

    // Analyze
    const analyzeResult = await analyzeDates(convertResult.dates)
    expect(analyzeResult.success).toBe(true)
  })
})
```

### Performance Tests

Resource usage validation:

```typescript
describe('Performance', () => {
  it('processes 1MB file within 5 seconds', () => {
    const content = generateLargeLogFile(1024 * 1024)
    const start = Date.now()

    extractDates(content, 'log')

    expect(Date.now() - start).toBeLessThan(5000)
  })

  it('uses less than 100MB memory', () => {
    const initial = process.memoryUsage().heapUsed
    const content = generateLargeLogFile(50 * 1024 * 1024)

    extractDates(content, 'log')

    const used = process.memoryUsage().heapUsed - initial
    expect(used).toBeLessThan(100 * 1024 * 1024)
  })
})
```

## Test Utilities

### Mock VS Code

```typescript
// __mocks__/vscode.ts
export function createMockContext(): vscode.ExtensionContext {
  return {
    subscriptions: { add: vi.fn(), dispose: vi.fn() },
    workspaceState: { get: vi.fn(), update: vi.fn() },
    globalState: { get: vi.fn(), update: vi.fn() },
    extensionPath: '/mock/path',
  }
}

export function createMockDependencies() {
  return {
    telemetry: { event: vi.fn(), error: vi.fn() },
    notifier: { info: vi.fn(), warning: vi.fn() },
    statusBar: { show: vi.fn(), hide: vi.fn() },
  }
}
```

### Test Data Generators

```typescript
export function generateLargeLogFile(bytes: number): string {
  const lines: string[] = []
  const lineSize = 100
  const numLines = Math.floor(bytes / lineSize)

  for (let i = 0; i < numLines; i++) {
    const timestamp = new Date(Date.now() + i * 1000).toISOString()
    lines.push(`[${timestamp}] Log message ${i}`)
  }

  return lines.join('\n')
}
```

## Running Tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Generate coverage report
npm test -- extract     # Run specific tests
```

## Coverage Requirements

- **Minimum**: 80% across all metrics
- **Critical Paths**: 100% for extraction functions
- **Reports**: HTML reports in `coverage/` directory

## Performance Benchmarks

| Input Size | Date Count | Max Duration | Max Memory |
| ---------- | ---------- | ------------ | ---------- |
| 1MB        | ~1,000     | 5s           | 100MB      |
| 10MB       | ~10,000    | 30s          | 200MB      |

## Quality Assurance

### Test Writing Principles

1. **Arrange-Act-Assert**: Clear test structure
2. **Single Focus**: One assertion per test
3. **Independence**: Tests run in any order
4. **Speed**: Under 100ms per test
5. **Descriptive**: Meaningful test names

### Error Testing

```typescript
describe('Error Handling', () => {
  it('handles file read errors', async () => {
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('Read error'))

    const result = await extractDatesFromFile('missing.log')

    expect(result.success).toBe(false)
    expect(result.errors[0].category).toBe('file-system')
  })

  it('recovers from partial failures', async () => {
    const content = 'valid-date\ninvalid-date\nvalid-date'
    const result = await extractDates(content, 'log')

    expect(result.success).toBe(true)
    expect(result.dates).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
  })
})
```

## Continuous Integration

GitHub Actions runs tests on every push:

```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

---

**Related:** [Architecture](ARCHITECTURE.md) | [Performance](PERFORMANCE.md) | [Development](DEVELOPMENT.md)
