# Dates-LE Development Guide

## Overview

This guide provides comprehensive information for developers working on Dates-LE, including setup, architecture, testing, and contribution guidelines.

## Prerequisites

### Required Software

- **Node.js**: Version 20.0.0 or higher
- **VS Code**: Version 1.105.0 or higher
- **Git**: For version control
- **TypeScript**: Version 5.0 or higher

### Recommended Tools

- **VS Code Extensions**:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Vitest
  - GitLens

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/nolindnaidoo/dates-le.git
cd dates-le
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Extension

```bash
npm run build
```

### 4. Run Tests

```bash
npm test
```

### 5. Package Extension

```bash
npm run package
```

## Project Structure

### Source Code Organization

```
src/
├── commands/           # Command implementations
│   ├── analyze.ts     # Date analysis command
│   ├── convert.ts      # Date conversion command
│   ├── extract.ts      # Date extraction command
│   ├── help.ts         # Help command
│   └── index.ts        # Command registration
├── config/            # Configuration management
│   ├── config.ts      # Configuration reading
│   └── settings.ts    # Settings command
├── extraction/        # Date extraction logic
│   ├── extract.ts     # Main extraction function
│   └── formats/       # Format-specific extractors
│       ├── csv.ts     # CSV date extraction
│       ├── json.ts    # JSON date extraction
│       ├── log.ts     # Log file date extraction
│       └── yaml.ts    # YAML date extraction
├── i18n/             # Localization files
│   └── package.nls.json
├── telemetry/        # Telemetry system
│   └── telemetry.ts
├── types.ts          # Type definitions
├── ui/               # User interface components
│   ├── notifier.ts   # Notification system
│   └── statusBar.ts  # Status bar integration
└── utils/            # Utility services
    ├── errorHandling.ts
    ├── localization.ts
    └── performance.ts
```

### Documentation Structure

```
docs/
├── ARCHITECTURE.md    # Architecture documentation
├── COMMANDS.md        # Command reference
├── CONFIGURATION.md   # Configuration guide
├── DEVELOPMENT.md     # This file
├── PERFORMANCE.md     # Performance guidelines
├── PRIVACY.md        # Privacy policy
├── SPECIFICATION.md   # Feature specification
├── TESTING.md        # Testing guidelines
└── TROUBLESHOOTING.md # Troubleshooting guide
```

## Architecture Patterns

### Functional Programming

- **Pure Functions**: All functions are pure with no side effects
- **Immutability**: Use `readonly` types and `Object.freeze()`
- **Factory Functions**: Create objects using factory functions
- **Dependency Injection**: Inject dependencies via parameters

### Example Factory Pattern

```typescript
export function createErrorHandler(deps: {
  logger: ErrorLogger
  notifier: ErrorNotifier
  config: ErrorConfig
}): ErrorHandler {
  return Object.freeze({
    handleError(error: UrlsLeError): void {
      // Error handling logic
    },
    // ... other methods
  })
}
```

### Service Registration Pattern

```typescript
export function registerCommands(
  context: vscode.ExtensionContext,
  deps: Readonly<{
    telemetry: Telemetry
    notifier: Notifier
    statusBar: StatusBar
    localizer: Localizer
    performanceMonitor: PerformanceMonitor
    errorHandler: ErrorHandler
  }>,
): void {
  // Register all commands with dependencies
}
```

## Development Workflow

### 1. Feature Development

1. **Create Branch**: `git checkout -b feature/feature-name`
2. **Implement Feature**: Follow architecture patterns
3. **Write Tests**: Add comprehensive test coverage
4. **Update Documentation**: Update relevant documentation
5. **Test Locally**: Run tests and manual testing
6. **Create PR**: Submit pull request for review

### 2. Bug Fixes

1. **Create Branch**: `git checkout -b fix/bug-description`
2. **Reproduce Bug**: Create test case that reproduces the issue
3. **Fix Bug**: Implement fix following patterns
4. **Verify Fix**: Ensure test passes and bug is resolved
5. **Update Tests**: Add regression test if needed
6. **Create PR**: Submit pull request for review

### 3. Documentation Updates

1. **Identify Need**: Determine what documentation needs updating
2. **Update Content**: Modify relevant documentation files
3. **Review Changes**: Ensure accuracy and completeness
4. **Test Examples**: Verify all code examples work
5. **Create PR**: Submit pull request for review

## Testing Strategy

### Test Organization

```
test/
├── unit/              # Unit tests
│   ├── commands/      # Command tests
│   ├── extraction/    # Extraction tests
│   └── utils/         # Utility tests
├── integration/       # Integration tests
│   └── extension.test.ts
└── fixtures/          # Test data
    ├── sample.log
    ├── sample.json
    └── sample.yaml
```

### Test Types

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test command workflows and interactions
- **Performance Tests**: Test large file processing and performance
- **Error Tests**: Test error handling and recovery

### Test Coverage Requirements

- **Minimum Coverage**: 80% code coverage
- **Critical Paths**: 100% coverage for critical functionality
- **Error Handling**: All error scenarios covered
- **Edge Cases**: All edge cases tested

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test src/commands/extract.test.ts
```

## Code Quality Standards

### TypeScript Configuration

- **Strict Mode**: Enable all strict TypeScript options
- **Type Safety**: Use explicit type annotations
- **Interface Design**: Design clear, focused interfaces
- **Generic Types**: Use generics for reusable code

### Code Style

- **Formatting**: Use Prettier for consistent formatting
- **Linting**: Use ESLint for code quality
- **Naming**: Use clear, descriptive names
- **Comments**: Document complex logic and decisions

### Error Handling

- **Error Categories**: Categorize errors appropriately
- **Recovery Actions**: Provide appropriate recovery actions
- **User Feedback**: Provide clear user feedback
- **Logging**: Log errors for debugging

## Performance Guidelines

### Memory Management

- **Efficient Algorithms**: Use efficient date parsing algorithms
- **Memory Cleanup**: Clean up resources after use
- **Streaming Processing**: Process large files in chunks
- **Caching**: Cache frequently used data appropriately

### CPU Optimization

- **Lazy Evaluation**: Defer expensive operations
- **Background Processing**: Process large files in background
- **Cancellation**: Support cancellation for long operations
- **Progress Indication**: Provide progress feedback

### File Processing

- **Size Limits**: Respect file size limits
- **Chunked Processing**: Process large files in chunks
- **Progress Updates**: Provide real-time progress updates
- **Error Recovery**: Handle file processing errors gracefully

## Debugging

### VS Code Debugging

1. **Set Breakpoints**: Set breakpoints in code
2. **Launch Extension**: Use "Launch Extension" configuration
3. **Debug Commands**: Debug specific commands
4. **Inspect Variables**: Inspect variable values
5. **Step Through Code**: Step through execution

### Logging

- **Output Channel**: Use VS Code output channel for logging
- **Log Levels**: Use appropriate log levels
- **Structured Logging**: Use structured log format
- **Error Context**: Include relevant context in logs

### Common Issues

- **Memory Leaks**: Monitor memory usage and cleanup
- **Performance Issues**: Profile performance bottlenecks
- **Error Handling**: Ensure proper error handling
- **Type Safety**: Verify TypeScript type safety

## Building and Packaging

### Development Build

```bash
# Build extension
npm run build

# Watch for changes
npm run watch
```

### Production Build

```bash
# Build for production
npm run build:prod

# Package extension
npm run package

# Publish extension
npm run publish
```

### Build Configuration

- **TypeScript**: Strict TypeScript compilation
- **Source Maps**: Generate source maps for debugging
- **Minification**: Minify code for production
- **Tree Shaking**: Remove unused code

## Contributing Guidelines

### Code Contributions

1. **Follow Patterns**: Follow established architecture patterns
2. **Write Tests**: Add tests for new functionality
3. **Update Documentation**: Update relevant documentation
4. **Code Review**: Submit code for review
5. **Quality Checks**: Ensure all quality checks pass

### Documentation Contributions

1. **Accuracy**: Ensure documentation is accurate
2. **Completeness**: Provide complete information
3. **Examples**: Include working code examples
4. **Clarity**: Write clear, understandable content
5. **Consistency**: Follow documentation style guide

### Issue Reporting

1. **Reproduce**: Provide steps to reproduce issues
2. **Environment**: Include environment information
3. **Logs**: Include relevant log output
4. **Expected Behavior**: Describe expected behavior
5. **Actual Behavior**: Describe actual behavior

## Release Process

### Version Management

- **Semantic Versioning**: Follow semantic versioning
- **Changelog**: Maintain detailed changelog
- **Release Notes**: Write comprehensive release notes
- **Tagging**: Tag releases appropriately

### Release Steps

1. **Update Version**: Update version in package.json
2. **Update Changelog**: Update CHANGELOG.md
3. **Build Extension**: Build extension for release
4. **Test Release**: Test release build thoroughly
5. **Create Release**: Create GitHub release
6. **Publish Extension**: Publish to VS Code Marketplace

## Troubleshooting

### Common Development Issues

- **Build Failures**: Check TypeScript errors and dependencies
- **Test Failures**: Review test output and fix issues
- **Performance Issues**: Profile and optimize code
- **Memory Issues**: Check for memory leaks and cleanup

### Getting Help

- **GitHub Issues**: Create issues for bugs and feature requests
- **Discussions**: Use GitHub discussions for questions
- **Documentation**: Check existing documentation
- **Code Review**: Request code review for complex changes

## Best Practices

### Development

- **Incremental Development**: Develop features incrementally
- **Test-Driven Development**: Write tests before implementation
- **Code Review**: Review all code changes
- **Documentation**: Keep documentation up to date

### Performance

- **Profile First**: Profile before optimizing
- **Measure Impact**: Measure performance impact
- **User Experience**: Prioritize user experience
- **Resource Usage**: Monitor resource usage

### Quality

- **Code Quality**: Maintain high code quality
- **Test Coverage**: Maintain high test coverage
- **Documentation**: Keep documentation comprehensive
- **User Feedback**: Incorporate user feedback

---

This development guide provides comprehensive information for developers working on Dates-LE, ensuring consistent development practices and high-quality contributions.
