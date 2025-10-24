# False Claims Governance

## Purpose

This document defines the standards and guidelines for preventing false claims in Dates-LE documentation, marketing materials, and user communications.

## Principles

### 1. Accuracy First

- All claims must be verifiable and accurate
- Use specific, measurable data when available
- Avoid absolute statements unless proven
- Include context and limitations

### 2. Evidence-Based

- Support claims with test results
- Use performance benchmarks from actual testing
- Reference specific versions and environments
- Provide reproducible evidence

### 3. Honest Communication

- Acknowledge limitations and known issues
- Use qualified language ("typically", "usually", "in most cases")
- Avoid marketing hyperbole
- Be transparent about trade-offs

## Prohibited Claims

### Performance Claims

- ❌ "Lightning fast" or "blazingly fast"
- ❌ "Instant" or "immediate" processing
- ❌ "Zero latency" or "no delay"
- ❌ Specific performance numbers without testing data

### Reliability Claims

- ❌ "100% reliable" or "never fails"
- ❌ "Bulletproof" or "foolproof"
- ❌ "Error-free" or "perfect accuracy"
- ❌ "Always works" or "guaranteed success"

### Coverage Claims

- ❌ "Supports all file formats"
- ❌ "Works with any data"
- ❌ "Universal compatibility"
- ❌ "Complete coverage" without specifics

### Quality Claims

- ❌ "Production-ready" without qualification
- ❌ "Enterprise-grade" without evidence
- ❌ "Professional quality" without standards
- ❌ "Best in class" without comparison

## Required Qualifiers

### Performance Metrics

- ✅ "High throughput" (with specific numbers from testing)
- ✅ "Optimized for" (specific use cases)
- ✅ "Typically processes" (with context)
- ✅ "Benchmarked at" (with test environment details)

### Reliability Statements

- ✅ "Reliable parsing" (with error handling details)
- ✅ "Robust error handling" (with specific examples)
- ✅ "Graceful degradation" (with fallback behavior)
- ✅ "Comprehensive validation" (with validation rules)

### Coverage Statements

- ✅ "Supports JSON, YAML, CSV, and XML formats"
- ✅ "Works with structured data files"
- ✅ "Compatible with VS Code" (with version requirements)
- ✅ "Tested on Windows, macOS, and Linux"

## Documentation Standards

### README Claims

- Include performance benchmarks from actual testing
- Specify supported file formats explicitly
- Mention known limitations and edge cases
- Provide test coverage percentages
- Include system requirements

### Changelog Claims

- Reference specific improvements with metrics
- Include before/after comparisons
- Mention performance improvements with numbers
- Acknowledge breaking changes
- Provide migration guidance

### Marketing Materials

- Use performance data from benchmarks
- Include disclaimers for edge cases
- Reference test environments
- Provide realistic use case examples
- Avoid absolute guarantees

## Verification Process

### Performance Claims

1. Run performance benchmarks
2. Document test environment
3. Include multiple test scenarios
4. Provide confidence intervals
5. Update regularly

### Feature Claims

1. Test all advertised features
2. Document edge cases
3. Include error scenarios
4. Provide examples
5. Validate across platforms

### Compatibility Claims

1. Test on all advertised platforms
2. Verify VS Code version compatibility
3. Test with various file sizes
4. Include system requirements
5. Document known issues

## Examples

### Good Performance Claim

```markdown
## Performance

Dates-LE has been benchmarked for high throughput across all formats:

| Format | Throughput        | Test Environment     |
| ------ | ----------------- | -------------------- |
| JSON   | 37,977+ dates/sec | M1 Mac, 1MB files    |
| CSV    | 24,649+ dates/sec | Intel i7, 10MB files |

_Results may vary based on file size, system performance, and date format complexity._
```

### Bad Performance Claim

```markdown
## Performance

Dates-LE is lightning fast and processes millions of dates instantly with zero latency.
```

### Good Reliability Claim

```markdown
## Reliability

Dates-LE provides robust error handling with graceful degradation for malformed data.
The extension includes comprehensive validation and will skip invalid dates while
continuing to process valid ones.
```

### Bad Reliability Claim

```markdown
## Reliability

Dates-LE is 100% reliable and never fails. It's bulletproof and works perfectly
with any data you throw at it.
```

## Monitoring and Enforcement

### Regular Reviews

- Review all documentation monthly
- Update performance benchmarks quarterly
- Validate claims against current testing
- Remove outdated or inaccurate information

### User Feedback

- Monitor user reports of false claims
- Investigate performance complaints
- Update documentation based on real usage
- Acknowledge and correct errors promptly

### Testing Requirements

- All performance claims must be backed by benchmarks
- Feature claims must be tested across platforms
- Compatibility claims must be verified
- Error handling must be demonstrated

## Consequences

### For False Claims

1. Immediate correction of documentation
2. Update of affected materials
3. Investigation of root cause
4. Process improvement to prevent recurrence

### For Accurate Claims

1. Regular validation and updates
2. Continuous monitoring
3. User feedback integration
4. Continuous improvement

---

**Related:** [Changelog Governance](CHANGELOG_GOVERNANCE.md)
