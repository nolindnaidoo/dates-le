# Dates-LE Commands

Complete reference for all Dates-LE commands, their usage, and configuration options.

## Core Commands

### Extract Dates (`dates-le.extract`)

**Purpose**: Extract dates from the active document and display results.

**Usage**:

- Command Palette: `Dates-LE: Extract Dates`
- Context Menu: Right-click in supported file types
- Keyboard Shortcut: `Ctrl+Shift+D` (configurable)

**Supported Formats**:

- JSON (`.json`)
- YAML (`.yaml`, `.yml`)
- CSV (`.csv`)
- XML (`.xml`)
- Log files (`.log`, `.txt`)
- HTML (`.html`)
- JavaScript/TypeScript (`.js`, `.ts`, `.jsx`, `.tsx`)

**Output**:

- Opens new editor with extracted dates
- Copies results to clipboard
- Shows performance metrics (throughput, processing time)
- Displays extraction statistics

**Configuration**:

```json
{
  "dates-le.extraction.dedupeEnabled": true,
  "dates-le.extraction.sortEnabled": false,
  "dates-le.safety.enabled": true,
  "dates-le.safety.fileSizeWarnBytes": 1048576
}
```

### Analyze Dates (`dates-le.analyze`)

**Purpose**: Perform comprehensive statistical analysis on extracted dates.

**Usage**:

- Command Palette: `Dates-LE: Analyze Dates`
- Context Menu: Available after extraction

**Analysis Features**:

- **Statistics**: Total, unique, duplicates, date ranges, averages, medians
- **Anomaly Detection**: Future dates, outliers, format inconsistencies
- **Pattern Detection**: Frequency patterns, seasonal trends, temporal gaps
- **Clustering**: Group similar dates by proximity
- **Gap Analysis**: Identify missing date ranges

**Output**:

- Generates markdown report with analysis results
- Opens report in new editor
- Includes visualizations and recommendations

**Configuration**:

```json
{
  "dates-le.analysis.enabled": true,
  "dates-le.analysis.includeStats": true,
  "dates-le.analysis.detectAnomalies": true,
  "dates-le.analysis.detectPatterns": true
}
```

### Convert Dates (`dates-le.convert`)

**Purpose**: Convert dates between different formats and timezones.

**Usage**:

- Command Palette: `Dates-LE: Convert Dates`
- Context Menu: Available after extraction

**Conversion Options**:

- **Target Formats**: ISO, RFC2822, Unix timestamp, UTC, local, custom
- **Timezone Conversion**: Convert to any timezone
- **Locale Support**: Format dates according to locale
- **Custom Formats**: User-defined date format strings

**Output**:

- Shows original and converted dates side-by-side
- Displays conversion metadata (timezone, format, locale)
- Copies converted dates to clipboard

**Configuration**:

```json
{
  "dates-le.conversion.defaultFormat": "iso",
  "dates-le.conversion.defaultTimezone": "UTC",
  "dates-le.conversion.defaultLocale": "en-US"
}
```

### Filter Dates (`dates-le.filter`)

**Purpose**: Filter dates based on various criteria.

**Usage**:

- Command Palette: `Dates-LE: Filter Dates`
- Context Menu: Available after extraction

**Filter Options**:

- **Date Range**: Filter by start and end dates
- **Format Inclusion**: Include only specific date formats
- **Format Exclusion**: Exclude specific date formats
- **Duplicate Removal**: Remove duplicate dates
- **Invalid Removal**: Remove invalid or unparseable dates
- **Future/Past Filtering**: Exclude future or past dates

**Output**:

- Shows filtered results with filter criteria
- Displays count of filtered vs. original dates
- Copies filtered dates to clipboard

**Configuration**:

```json
{
  "dates-le.filtering.defaultRange": "all",
  "dates-le.filtering.removeDuplicates": true,
  "dates-le.filtering.removeInvalid": true
}
```

### Validate Dates (`dates-le.validate`)

**Purpose**: Validate dates against configurable rules.

**Usage**:

- Command Palette: `Dates-LE: Validate Dates`
- Context Menu: Available after extraction

**Validation Rules**:

- **Format Validation**: Ensure dates match expected formats
- **Range Validation**: Check dates are within acceptable ranges
- **Business Rules**: Custom validation logic
- **Severity Levels**: Error, warning, or info level validation

**Output**:

- Generates validation report with results
- Shows passed, failed, and warning validations
- Provides suggestions for fixing invalid dates
- Displays validation statistics

**Configuration**:

```json
{
  "dates-le.validation.enabled": true,
  "dates-le.validation.severity": "warning",
  "dates-le.validation.rules": [
    {
      "name": "future-dates",
      "type": "range",
      "max": "now",
      "severity": "warning"
    }
  ]
}
```

## Post-Processing Commands

### Deduplicate Dates (`dates-le.dedupe`)

**Purpose**: Remove duplicate dates from extraction results.

**Usage**:

- Command Palette: `Dates-LE: Deduplicate Dates`
- Context Menu: Available after extraction

**Deduplication Methods**:

- **Exact Match**: Remove identical date strings
- **Timestamp Match**: Remove dates with same timestamp
- **Format Normalization**: Normalize formats before deduplication

**Output**:

- Shows deduplicated results
- Displays count of removed duplicates
- Copies deduplicated dates to clipboard

### Sort Dates (`dates-le.sort`)

**Purpose**: Sort dates in ascending or descending order.

**Usage**:

- Command Palette: `Dates-LE: Sort Dates`
- Context Menu: Available after extraction

**Sort Options**:

- **Ascending**: Oldest dates first
- **Descending**: Newest dates first
- **Format Grouping**: Group by date format
- **Custom Sorting**: User-defined sort criteria

**Output**:

- Shows sorted results
- Displays sort criteria used
- Copies sorted dates to clipboard

## Configuration Commands

### Open Settings (`dates-le.settings`)

**Purpose**: Open Dates-LE configuration settings.

**Usage**:

- Command Palette: `Dates-LE: Open Settings`
- Context Menu: Available in any editor

**Settings Categories**:

- **Extraction**: Format support, deduplication, sorting
- **Analysis**: Statistical analysis, anomaly detection
- **Conversion**: Default formats, timezones, locales
- **Filtering**: Default filters, range settings
- **Validation**: Validation rules, severity levels
- **Safety**: File size limits, memory usage
- **Performance**: Monitoring, benchmarking
- **UI**: Status bar, notifications, prompts

## Keyboard Shortcuts

| Command             | Default Shortcut | Description                        |
| ------------------- | ---------------- | ---------------------------------- |
| `dates-le.extract`  | `Ctrl+Shift+D`   | Extract dates from active document |
| `dates-le.analyze`  | `Ctrl+Shift+A`   | Analyze extracted dates            |
| `dates-le.convert`  | `Ctrl+Shift+C`   | Convert date formats               |
| `dates-le.filter`   | `Ctrl+Shift+F`   | Filter dates by criteria           |
| `dates-le.validate` | `Ctrl+Shift+V`   | Validate dates against rules       |
| `dates-le.dedupe`   | `Ctrl+Shift+U`   | Remove duplicate dates             |
| `dates-le.sort`     | `Ctrl+Shift+S`   | Sort dates                         |

## Context Menu Integration

Dates-LE commands are available in the context menu for supported file types:

- **JSON files**: All commands available
- **YAML files**: All commands available
- **CSV files**: All commands available
- **XML files**: All commands available
- **Log files**: Extract and analyze commands
- **HTML files**: Extract and analyze commands
- **JavaScript/TypeScript**: Extract and analyze commands

## Command Dependencies

Some commands depend on others:

- **Analyze, Convert, Filter, Validate**: Require extracted dates
- **Dedupe, Sort**: Can work on any date list
- **Settings**: Independent of extraction state

## Error Handling

All commands include comprehensive error handling:

- **Graceful Degradation**: Continue processing on partial failures
- **User Feedback**: Clear error messages and recovery suggestions
- **Logging**: Detailed error logs for debugging
- **Recovery**: Automatic retry and fallback mechanisms

## Performance Considerations

- **Large Files**: Commands automatically handle large files with progress indicators
- **Memory Usage**: Streaming processing for files >1MB
- **Cancellation**: All commands support cancellation via VS Code
- **Caching**: Results are cached to improve subsequent operations

## Integration with Other Extensions

Dates-LE integrates with:

- **VS Code Explorer**: Context menu integration
- **Command Palette**: All commands searchable
- **Status Bar**: Real-time processing feedback
- **Output Panel**: Detailed logging and debugging
- **Settings UI**: Native VS Code settings integration

---

**Related**: [Architecture](ARCHITECTURE.md) • [Performance](PERFORMANCE.md) • [Configuration](../package.json)
