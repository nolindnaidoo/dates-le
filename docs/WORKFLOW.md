# Dates-LE Workflow Guide

Practical workflows that turn common pain points into fast, repeatable actions.

## Why this exists (real‑world pain points)

### Log analysis and debugging
- You need to analyze log files for date patterns, anomalies, and temporal relationships.
- Pain: hunting scattered date values, identifying patterns, and understanding temporal sequences.
- Relief: extract dates from log files, analyze patterns, and identify anomalies automatically.

### Configuration file auditing
- You want to catalog date values in configuration files and ensure consistency.
- Pain: dates live across YAML/JSON/INI files; manual grepping is noisy and error-prone.
- Relief: extract from configuration files, validate formats, and produce clean lists for review.

### Data migration and cleanup
- You're migrating data between systems or cleaning up inconsistent date formats.
- Pain: scattered date values across multiple files make it easy to miss updates.
- Relief: extract dates from source files, convert formats, and identify inconsistencies.

### Compliance and auditing
- You need to ensure date formats meet compliance requirements and audit temporal data.
- Pain: manually checking date formats and identifying non-compliant values.
- Relief: extract dates, validate formats, and flag compliance issues automatically.

---

## Core workflows

### 1) Quick extract & review (any supported file)
1. Open a supported file (`JSON`, `YAML`, `CSV`, `LOG`, `INI`, `JavaScript`, `TypeScript`).
2. Run `Dates-LE: Extract Dates` (`Cmd/Ctrl+Alt+D` or Status Bar).
3. If prompted for large output, choose Open or Copy.
4. Optionally run Convert/Analyze to process results.

### 2) Log file analysis
1. Open your log file (e.g., `application.log`, `error.log`).
2. Run `Dates-LE: Extract Dates`.
3. Run `Dates-LE: Analyze Dates` for pattern analysis.
4. Review extracted dates for anomalies and patterns.

### 3) Configuration file auditing
1. Open configuration files (YAML, JSON, INI, etc.).
2. Extract dates from each configuration file.
3. Compare results side-by-side to identify inconsistencies.
4. Use analysis features to check format compliance.

### 4) Data migration workflow
1. Extract dates from source files.
2. Convert dates to target format.
3. Validate converted dates for accuracy.
4. Update target files with converted dates.

---

## Advanced workflows

### 5) Compliance checking
1. Extract dates from your application files.
2. Run `Dates-LE: Analyze Dates` for format validation.
3. Review compliance issues and format violations.
4. Update non-compliant date formats.

### 6) Temporal analysis
1. Extract dates from time-series data.
2. Analyze date patterns and relationships.
3. Identify anomalies and outliers.
4. Generate temporal analysis reports.

### 7) Performance optimization
1. Extract dates from large data files.
2. Identify duplicate or redundant date values.
3. Optimize date storage and processing.
4. Monitor performance impact of date operations.

---

## File type workflows

### Log files
- **Primary use**: Log analysis, debugging, temporal pattern identification
- **Workflow**: Extract → Analyze → Report
- **Key features**: Timestamp parsing, pattern recognition, anomaly detection

### JSON/YAML files
- **Primary use**: Configuration auditing, data validation, format checking
- **Workflow**: Extract → Validate → Update
- **Key features**: Nested object parsing, array processing, format validation

### CSV files
- **Primary use**: Data analysis, migration, format conversion
- **Workflow**: Extract → Convert → Validate
- **Key features**: Column-based extraction, format conversion, validation

### JavaScript/TypeScript files
- **Primary use**: Code analysis, date literal extraction, format auditing
- **Workflow**: Extract → Analyze → Refactor
- **Key features**: String literal parsing, template literal processing, object property extraction

---

## Configuration workflows

### 8) Custom extraction settings
1. Configure `dates-le.extraction.includeComments` for documentation dates
2. Set `dates-le.extraction.includeCustomFormats` for specific date patterns
3. Adjust `dates-le.extraction.includeTimezoneInfo` for timezone analysis
4. Test extraction with different settings

### 9) Analysis configuration
1. Set `dates-le.analysis.patternDetection` for pattern recognition
2. Configure `dates-le.analysis.anomalyDetection` for outlier identification
3. Enable `dates-le.analysis.temporalAnalysis` for relationship analysis
4. Run analysis with different configurations

### 10) Output formatting
1. Choose `dates-le.output.format` (iso, rfc2822, unix, utc, local, original)
2. Set `dates-le.output.includePosition` for line/column info
3. Configure `dates-le.output.includeContext` for surrounding code
4. Customize output for different use cases

---

## Integration workflows

### 11) VS Code integration
1. Use Command Palette (`Ctrl+Shift+P`) for all commands
2. Right-click context menu for quick extraction
3. Status bar for always-available access
4. Keyboard shortcuts for power users

### 12) Team collaboration
1. Share extracted date patterns with team members
2. Use analysis results for compliance discussions
3. Standardize date formats across projects
4. Document date handling decisions and rationale

### 13) CI/CD integration
1. Extract dates as part of build process
2. Validate date formats against compliance requirements
3. Check for date-related issues automatically
4. Fail builds on date format violations

---

## Troubleshooting workflows

### 14) Common issues
1. **No dates found**: Check file type support and date formats
2. **Parse errors**: Verify date syntax and file encoding
3. **Performance issues**: Adjust safety settings for large files
4. **Missing features**: Check configuration and extension version

### 15) Debug workflow
1. Enable `dates-le.telemetryEnabled` for detailed logging
2. Check Output panel for error messages
3. Test with different file types and sizes
4. Verify VS Code and extension versions

---

## Best practices

### File organization
- Keep date-related files organized by purpose
- Use consistent date format conventions
- Document date handling decisions and rationale
- Version control date format changes

### Performance considerations
- Use safety settings for large files
- Enable performance monitoring
- Optimize date processing regularly
- Monitor memory usage

### Compliance requirements
- Run compliance analysis regularly
- Check date formats against standards
- Update non-compliant dates promptly
- Document compliance decisions

### Team collaboration
- Share date patterns and analysis results
- Standardize date formats across projects
- Use consistent naming conventions
- Document date handling decisions and rationale
