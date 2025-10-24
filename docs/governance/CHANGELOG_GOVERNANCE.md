# Changelog Governance

## Purpose

This document defines the standards and guidelines for maintaining the Dates-LE changelog to ensure consistency, clarity, and user-focused communication.

## Principles

### 1. User-Focused Content

- Write for end users, not developers
- Focus on benefits and improvements, not technical implementation
- Use clear, non-technical language
- Highlight what users can do with new features

### 2. Scannable Format

- Use clear headings and bullet points
- Group related changes together
- Use consistent formatting throughout
- Make it easy to find specific information

### 3. Consistent Structure

- Follow [Keep a Changelog](https://keepachangelog.com/) format
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Include release dates
- Organize by change type (Added, Changed, Fixed, Removed, Security)

## Content Guidelines

### What to Include

- New features and capabilities
- Bug fixes that affect user experience
- Performance improvements
- Breaking changes
- Deprecations
- Security updates

### What to Exclude

- Internal refactoring
- Code quality improvements
- Test coverage changes
- Build system updates
- Documentation updates (unless user-facing)

### Writing Style

- Use present tense ("Add feature" not "Added feature")
- Be specific about what changed
- Include context for why changes were made
- Use active voice
- Keep entries concise but informative

## Change Types

### Added

- New features
- New commands
- New file format support
- New configuration options
- New keyboard shortcuts

### Changed

- Modified existing behavior
- Updated default settings
- Improved user interface
- Enhanced performance
- Updated dependencies

### Fixed

- Bug fixes
- Error handling improvements
- UI/UX corrections
- Performance issues
- Compatibility problems

### Removed

- Deprecated features
- Removed commands
- Discontinued file format support
- Breaking changes

### Security

- Security vulnerabilities
- Authentication changes
- Permission updates
- Data handling improvements

## Examples

### Good Entry

```markdown
### Added

- **Date Analysis Command** - Comprehensive statistical analysis with anomaly detection
  - Statistical insights: total, unique, duplicates, date ranges, averages, medians
  - Anomaly detection: future dates, outliers, format inconsistencies
  - Pattern detection: frequency patterns, seasonal trends, temporal gaps
```

### Bad Entry

```markdown
### Added

- Implemented DateAnalysisService with comprehensive statistical analysis
- Added anomaly detection algorithms using IQR method
- Created pattern detection using linear regression
- Fixed TypeScript compilation errors in analysis module
```

## Review Process

1. **Draft**: Create changelog entry during development
2. **Review**: Ensure entry follows guidelines
3. **Validate**: Check accuracy and completeness
4. **Finalize**: Update before release

## Maintenance

- Update changelog with each commit that affects users
- Review and consolidate entries before releases
- Remove or consolidate minor changes
- Ensure consistency across all entries
- Validate all links and references

## Tools

- Use automated tools to generate initial entries
- Validate format with changelog linters
- Check for consistency with previous entries
- Ensure proper semantic versioning

---

**Related:** [False Claims Governance](FALSE_CLAIMS_GOVERNANCE.md)
