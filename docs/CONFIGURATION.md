# Dates-LE Configuration

## Overview

Dates-LE provides comprehensive configuration options to customize behavior, performance, and user experience. All settings are designed with developer empathy in mind, providing sensible defaults while allowing fine-grained control.

## Configuration Categories

### 1. Basic Settings

#### Copy to Clipboard (`copyToClipboardEnabled`)

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Automatically copy extraction results to the clipboard
- **Usage**: Enable for quick sharing of extracted dates

#### Deduplication (`dedupeEnabled`)

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Remove duplicate dates from extraction results
- **Usage**: Useful when processing files with repeated date entries

#### Notification Level (`notificationsLevel`)

- **Type**: `'all' | 'important' | 'silent'`
- **Default**: `'silent'`
- **Description**: Controls the verbosity of notifications
- **Options**:
  - `'all'`: Show all notifications including info messages
  - `'important'`: Show only important notifications and errors
  - `'silent'`: Suppress all notifications except critical errors

#### Status Bar (`statusBar.enabled`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Show Dates-LE status bar entry for quick access
- **Usage**: Provides quick access to extraction commands

### 2. Safety Settings

#### Safety Checks (`safety.enabled`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable safety checks for large files and operations
- **Usage**: Prevents processing of extremely large files that could impact performance

#### File Size Warning (`safety.fileSizeWarnBytes`)

- **Type**: `number`
- **Default**: `1000000` (1MB)
- **Minimum**: `100000` (100KB)
- **Description**: Warn when input file size exceeds this threshold in bytes
- **Usage**: Adjust based on your system's capabilities and file sizes

#### Large Output Warning (`safety.largeOutputLinesThreshold`)

- **Type**: `number`
- **Default**: `50000`
- **Minimum**: `1000`
- **Description**: Warn before opening/copying when result lines exceed this threshold
- **Usage**: Prevents overwhelming the editor with large result sets

#### Many Documents Warning (`safety.manyDocumentsThreshold`)

- **Type**: `number`
- **Default**: `8`
- **Minimum**: `2`
- **Description**: Warn before opening multiple result documents when count exceeds this threshold
- **Usage**: Prevents opening too many result documents simultaneously

### 3. Analysis Settings

#### Analysis Enabled (`analysis.enabled`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable date analysis features
- **Usage**: Disable to improve performance for simple extraction tasks

#### Pattern Analysis (`analysis.includePatterns`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include pattern recognition in analysis
- **Usage**: Identifies common date patterns and formats

#### Anomaly Detection (`analysis.includeAnomalies`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include anomaly detection in analysis
- **Usage**: Detects future dates, invalid dates, duplicates, and outliers

#### Range Analysis (`analysis.includeRanges`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include range analysis in analysis
- **Usage**: Analyzes date ranges and intervals

#### Frequency Analysis (`analysis.includeFrequency`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include frequency distribution analysis
- **Usage**: Analyzes date frequency and distribution patterns

### 4. Conversion Settings

#### Default Output Format (`conversion.defaultFormat`)

- **Type**: `string`
- **Default**: `'iso8601'`
- **Options**: `'iso8601'`, `'rfc2822'`, `'unix'`, `'utc'`, `'local'`, `'custom'`
- **Description**: Default format for date conversions
- **Usage**: Set your preferred output format for consistency

#### Default Timezone (`conversion.defaultTimezone`)

- **Type**: `string`
- **Default**: `'UTC'`
- **Description**: Default timezone for date conversions
- **Usage**: Set your local timezone or UTC for consistency

#### Locale Support (`conversion.localeEnabled`)

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable locale-specific date formatting
- **Usage**: Format dates according to your locale preferences

#### Custom Format (`conversion.customFormat`)

- **Type**: `string`
- **Default**: `'YYYY-MM-DD HH:mm:ss'`
- **Description**: Custom date format specification
- **Usage**: Define your own date format using standard format tokens

### 5. Performance Settings

#### Performance Monitoring (`performance.enabled`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable performance monitoring and optimization
- **Usage**: Track performance metrics and identify bottlenecks

#### Maximum Duration (`performance.maxDuration`)

- **Type**: `number`
- **Default**: `5000` (5 seconds)
- **Minimum**: `1000` (1 second)
- **Description**: Maximum processing duration in milliseconds before warning
- **Usage**: Adjust based on your performance requirements

#### Maximum Memory Usage (`performance.maxMemoryUsage`)

- **Type**: `number`
- **Default**: `104857600` (100MB)
- **Minimum**: `1048576` (1MB)
- **Description**: Maximum memory usage in bytes before warning
- **Usage**: Prevent excessive memory consumption

#### Maximum CPU Usage (`performance.maxCpuUsage`)

- **Type**: `number`
- **Default**: `1000000` (1 second)
- **Minimum**: `100000` (0.1 seconds)
- **Description**: Maximum CPU usage in milliseconds before warning
- **Usage**: Monitor CPU-intensive operations

#### Minimum Throughput (`performance.minThroughput`)

- **Type**: `number`
- **Default**: `1000`
- **Minimum**: `100`
- **Description**: Minimum throughput in dates per second before warning
- **Usage**: Ensure acceptable processing speed

#### Maximum Cache Size (`performance.maxCacheSize`)

- **Type**: `number`
- **Default**: `1000`
- **Minimum**: `100`
- **Description**: Maximum cache size in entries before cleanup
- **Usage**: Control memory usage from caching

### 6. Error Handling Settings

#### Show Parse Errors (`showParseErrors`)

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Show parse errors as VS Code notifications when parsing fails
- **Usage**: Enable for debugging date parsing issues

#### Error Recovery (`errorRecovery.enabled`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable automatic error recovery mechanisms
- **Usage**: Automatically handle common parsing and processing errors

#### Error Logging (`errorLogging.enabled`)

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable detailed error logging to output channel
- **Usage**: Log errors for debugging and troubleshooting

### 7. Telemetry Settings

#### Telemetry Enabled (`telemetryEnabled`)

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable local-only telemetry logs to the Output panel
- **Usage**: Track extension usage and performance metrics locally

#### Telemetry Level (`telemetryLevel`)

- **Type**: `'minimal' | 'standard' | 'detailed'`
- **Default**: `'minimal'`
- **Description**: Level of telemetry data collection
- **Options**:
  - `'minimal'`: Basic usage events only
  - `'standard'`: Standard usage and performance metrics
  - `'detailed'`: Detailed performance and error metrics

## Configuration Methods

### 1. VS Code Settings UI

- Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
- Navigate to Extensions → Dates-LE
- Modify settings using the graphical interface

### 2. Settings JSON

- Open User Settings JSON (`Ctrl+Shift+P` → "Preferences: Open User Settings (JSON)")
- Add Dates-LE configuration:

```json
{
  "dates-le.copyToClipboardEnabled": true,
  "dates-le.dedupeEnabled": true,
  "dates-le.notificationsLevel": "important",
  "dates-le.safety.enabled": true,
  "dates-le.safety.fileSizeWarnBytes": 2000000,
  "dates-le.analysis.enabled": true,
  "dates-le.conversion.defaultFormat": "iso8601",
  "dates-le.performance.enabled": true
}
```

### 3. Workspace Settings

- Create `.vscode/settings.json` in your workspace
- Add Dates-LE configuration for project-specific settings

### 4. Command Palette

- Use `Dates-LE: Open Settings` command
- Navigate directly to Dates-LE settings

## Configuration Validation

### Automatic Validation

- Settings are validated when the extension loads
- Invalid values are reset to defaults
- Warnings are shown for invalid configurations

### Manual Validation

- Use the `Dates-LE: Validate Configuration` command
- Check for configuration conflicts
- Get recommendations for optimal settings

## Configuration Best Practices

### Performance Optimization

- Enable safety checks for large files
- Set appropriate file size thresholds
- Use performance monitoring
- Configure memory and CPU limits

### User Experience

- Set notification level to "important" for most users
- Enable status bar for quick access
- Configure default output format
- Set appropriate timezone

### Development Workflow

- Enable detailed error logging
- Use custom date formats for consistency
- Enable all analysis features
- Set higher performance thresholds

### Production Environment

- Disable telemetry if not needed
- Use silent notification level
- Enable safety checks
- Set conservative performance limits

## Configuration Examples

### Basic Setup

```json
{
  "dates-le.copyToClipboardEnabled": false,
  "dates-le.dedupeEnabled": true,
  "dates-le.notificationsLevel": "important",
  "dates-le.safety.enabled": true
}
```

### Advanced Setup

```json
{
  "dates-le.copyToClipboardEnabled": true,
  "dates-le.dedupeEnabled": true,
  "dates-le.notificationsLevel": "all",
  "dates-le.safety.enabled": true,
  "dates-le.safety.fileSizeWarnBytes": 5000000,
  "dates-le.analysis.enabled": true,
  "dates-le.analysis.includePatterns": true,
  "dates-le.analysis.includeAnomalies": true,
  "dates-le.conversion.defaultFormat": "iso8601",
  "dates-le.conversion.defaultTimezone": "UTC",
  "dates-le.performance.enabled": true,
  "dates-le.performance.maxDuration": 10000
}
```

### Performance-Focused Setup

```json
{
  "dates-le.safety.enabled": true,
  "dates-le.safety.fileSizeWarnBytes": 1000000,
  "dates-le.analysis.enabled": false,
  "dates-le.performance.enabled": true,
  "dates-le.performance.maxDuration": 3000,
  "dates-le.performance.maxMemoryUsage": 52428800
}
```

## Troubleshooting Configuration

### Common Issues

- **Settings not applied**: Restart VS Code or reload extension
- **Invalid values**: Check setting types and ranges
- **Performance issues**: Adjust safety and performance settings
- **Memory problems**: Reduce cache size and memory limits

### Configuration Reset

- Use `Dates-LE: Reset Configuration` command
- Reset to default values
- Clear custom configurations

### Configuration Backup

- Export configuration using `Dates-LE: Export Configuration`
- Import configuration using `Dates-LE: Import Configuration`
- Share configurations across team members

---

This configuration guide provides comprehensive information about all Dates-LE settings, helping users customize the extension to their specific needs while maintaining optimal performance and user experience.
