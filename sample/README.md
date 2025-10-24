# Dates-LE Sample Files

This directory contains sample files designed to demonstrate and test Dates-LE's date extraction capabilities across various formats and scenarios.

## 📁 Sample Files Overview

| File                  | Format | Dates | Description                                      |
| --------------------- | ------ | ----- | ------------------------------------------------ |
| **api-response.json** | JSON   | ~50   | API response with ISO 8601 timestamps, timezones |
| **application.log**   | LOG    | ~50   | Application log with various timestamp formats   |
| **schedule.csv**      | CSV    | ~45   | Project schedule with date columns               |
| **config.yaml**       | YAML   | ~40   | Configuration file with date/time settings       |

**Total**: ~185 dates across 4 files demonstrating multiple date formats.

## 🚀 Quick Start

1. Open any sample file in VS Code
2. Press `Cmd+Alt+D` (macOS) or `Ctrl+Alt+D` (Windows/Linux)
3. View extracted dates in a new editor tab

> 💡 **First time?** Try `api-response.json` first—it has clean, well-formatted ISO 8601 dates perfect for getting started!

---

## 📋 Categorized Test Scenarios

### 1. Basic Date Extraction

**Goal**: Verify core date extraction functionality across supported formats.

- **Test File**: `api-response.json`
- **Expected Result**: ~50 dates extracted
- **What to Look For**:
  - ISO 8601 formats with various precisions
  - Timezone-aware timestamps (UTC, offset)
  - Date-only formats (YYYY-MM-DD)
  - Millisecond precision timestamps

### 2. Multiple Date Formats

**Goal**: Test extraction across different date representation styles.

- **Test File**: `application.log`
- **Expected Result**: ~50 dates extracted
- **What to Look For**:
  - Standard log timestamps (YYYY-MM-DD HH:MM:SS.sss)
  - ISO 8601 formats
  - RFC 2822 formats (Mon, DD MMM YYYY HH:MM:SS GMT)
  - Unix-like timestamps
  - Mixed precision levels

### 3. Structured Data (CSV)

**Goal**: Verify date extraction from tabular data.

- **Test File**: `schedule.csv`
- **Expected Result**: ~45 dates extracted
- **What to Look For**:
  - Date columns (YYYY-MM-DD)
  - DateTime columns (YYYY-MM-DD HH:MM:SS)
  - Multiple date columns per row
  - Consistent format across rows

### 4. Configuration Files (YAML)

**Goal**: Test extraction from YAML configuration files.

- **Test File**: `config.yaml`
- **Expected Result**: ~40 dates extracted
- **What to Look For**:
  - ISO 8601 timestamps in nested structures
  - Date ranges (start/end pairs)
  - Scheduled event timestamps
  - Metadata dates

### 5. Deduplication

**Goal**: Verify date deduplication functionality.

**Steps**:

1. Open `api-response.json`
2. Enable deduplication: `Settings → dates-le.dedupeEnabled: true`
3. Run extraction
4. **Expected**: Fewer dates if duplicates exist
5. **Verify**: No duplicate dates in output

### 6. Sorting & Organization

**Goal**: Verify date sorting and chronological organization.

- **Test File**: Any sample file
- **Expected Result**: Dates sorted chronologically
- **What to Look For**:
  - Earliest dates first
  - Consistent ordering
  - Proper timezone handling for sorting

### 7. Large File Warning

**Goal**: Test safety warnings for large files.

**Steps**:

1. Create a copy of `application.log` and duplicate its contents 100x
2. Open the large file
3. Run extraction
4. **Expected**: File size warning before processing
5. **Verify**: Can proceed or cancel

### 8. Side-by-Side Results

**Goal**: Verify side-by-side editor functionality.

**Steps**:

1. Enable: `Settings → dates-le.openResultsSideBySide: true`
2. Open any sample file
3. Run extraction
4. **Expected**: Results open in adjacent editor
5. **Verify**: Source file remains visible

### 9. Copy to Clipboard

**Goal**: Test automatic clipboard integration.

**Steps**:

1. Enable: `Settings → dates-le.copyToClipboardEnabled: true`
2. Open `api-response.json`
3. Run extraction
4. **Expected**: Results copied to clipboard
5. **Verify**: Paste results into another document

### 10. Notification Levels

**Goal**: Test notification system behavior.

**Test Sequence**:

**A. Silent Mode** (default):

- `Settings → dates-le.notificationsLevel: "silent"`
- Run extraction on `api-response.json`
- **Expected**: No notifications (except errors)

**B. Important Mode**:

- `Settings → dates-le.notificationsLevel: "important"`
- Run extraction on very large file
- **Expected**: Warnings only

**C. All Mode**:

- `Settings → dates-le.notificationsLevel: "all"`
- Run extraction on `schedule.csv`
- **Expected**: Success notification with count

---

## 🔍 Edge Cases & Advanced Testing

### Empty File

- **Action**: Create empty file `empty.json`
- **Expected**: No dates found, graceful handling
- **Error**: None

### No Dates

```json
{
  "name": "Test",
  "count": 42,
  "enabled": true
}
```

- **Expected**: "No dates found" message
- **Error**: None

### Invalid JSON/YAML/CSV

```json
{
  "broken": "json"
  "missing": "comma"
}
```

- **Expected**: Parse error (if `showParseErrors` enabled)
- **Error**: Graceful error handling, no crash

### Mixed Valid/Invalid Dates

- **File**: Create JSON with mix of valid ISO dates and invalid strings
- **Expected**: Only valid dates extracted
- **Error**: None (invalid dates skipped)

### Very Large Output

- **Action**: Create file with 100,000+ dates
- **Expected**: Warning before opening results
- **Prompt**: "Output size (100,000 lines) exceeds threshold. Continue?"

### Timezone Edge Cases

```json
{
  "utc": "2025-10-13T12:00:00Z",
  "offset_positive": "2025-10-13T12:00:00+05:30",
  "offset_negative": "2025-10-13T12:00:00-08:00",
  "no_timezone": "2025-10-13T12:00:00"
}
```

- **Expected**: All dates extracted with timezone info preserved

### Date Ranges

```yaml
maintenance:
  start: '2025-10-14T02:00:00Z'
  end: '2025-10-14T04:00:00Z'
```

- **Expected**: Both dates extracted separately

### Null Dates

```json
{
  "shippedDate": null,
  "deliveredDate": null
}
```

- **Expected**: Null dates ignored (not extracted)

### String Dates vs Numeric Timestamps

```json
{
  "isoString": "2025-10-13T12:00:00Z",
  "unixTimestamp": 1728824400000,
  "version": "1.0.0"
}
```

- **Expected**: ISO string extracted, numbers (version/timestamp) may be filtered

---

## ⚡ Performance Testing Guidelines

### Small Files (< 1KB)

- **Test File**: Create minimal JSON with 5 dates
- **Expected**: < 100ms extraction time
- **Verify**: No performance warnings

### Medium Files (1KB - 1MB)

- **Test Files**: All provided samples
- **Expected**: < 1 second extraction time
- **Verify**: Smooth, responsive extraction

### Large Files (1MB - 50MB)

- **Action**: Duplicate `application.log` 100x
- **Expected**: < 5 seconds extraction time
- **Verify**: Progress indicator shown

### Very Large Files (> 50MB)

- **Action**: Create/open file exceeding safety threshold
- **Expected**: Safety warning before processing
- **Verify**: Can cancel operation

---

## 🐛 Troubleshooting

### No Dates Extracted

**Possible Causes**:

1. File format not supported (only JSON, YAML, CSV)
2. File not saved with correct extension
3. No valid date formats in file
4. Parse error (enable `showParseErrors`)

**Solution**:

- Check file extension (.json, .yaml, .yml, .csv)
- Verify file contains valid date strings
- Check Output panel → "Dates-LE" for errors

### Performance Issues

**Symptoms**: Slow extraction, high memory usage

**Solutions**:

1. Enable safety warnings: `dates-le.safety.enabled: true`
2. Reduce file size threshold: `dates-le.safety.fileSizeWarnBytes: 500000`
3. Split large files into smaller chunks
4. Close other extensions temporarily

### Unexpected Results

**Example**: Expected 50 dates, got 48

**Debugging**:

1. Check if deduplication is enabled
2. Verify date formats are recognized
3. Look for null values or invalid formats
4. Enable telemetry: `dates-le.telemetryEnabled: true`
5. Check Output panel for warnings

---

## 📚 Additional Resources

- **Documentation**: See `/docs` directory
- **Configuration**: Check `CONFIGURATION.md`
- **Performance**: Read `PERFORMANCE.md`
- **Troubleshooting**: Review `TROUBLESHOOTING.md`

---

## 🎯 Coverage Summary

These sample files comprehensively test:

✅ **Date Formats**:

- ISO 8601 (various precisions)
- RFC 2822
- Simple dates (YYYY-MM-DD)
- DateTime strings (YYYY-MM-DD HH:MM:SS)
- Unix timestamps

✅ **File Formats**:

- JSON (nested structures, arrays)
- YAML (configurations, hierarchies)
- CSV (tabular data)
- LOG (mixed formats)

✅ **Edge Cases**:

- Null values
- Timezones (UTC, offsets)
- Millisecond precision
- Date ranges
- Large files
- Empty files

✅ **Features**:

- Deduplication
- Sorting
- Side-by-side view
- Clipboard copy
- Safety warnings
- Notification levels

---

**Happy Testing!** 🚀

If you discover any issues or have suggestions for additional test cases, please [open an issue](https://github.com/OffensiveEdge/dates-le/issues).
