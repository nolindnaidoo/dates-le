# Dates-LE Commands

## Overview

Dates-LE provides a focused set of commands for extracting dates from structured data files (JSON, YAML, CSV). All commands are designed with the "Zero Hassle" philosophy, providing clear feedback and graceful error handling.

## Core Commands

### 1. Extract Dates (`dates-le.extractDates`)

**Purpose**: Extract all dates from the current document and display them in their original format.

**Usage**:

- **Command Palette**: `Dates-LE: Extract Dates`
- **Keyboard Shortcut**: `Ctrl+Alt+D` (Windows/Linux) or `Cmd+Alt+D` (Mac)
- **Context Menu**: Right-click in editor → `Extract Dates`

**Supported File Types**:

- JSON (`.json`)
- YAML (`.yaml`, `.yml`)
- CSV (`.csv`)

**Features**:

- Detects dates in various formats:
  - ISO 8601: `2023-12-25T10:30:00.000Z`
  - RFC 2822: `Mon, 25 Dec 2023 10:30:00 GMT`
  - Unix timestamps: `1703508600` (both 10 and 13 digit)
  - UTC format: `Mon Dec 25 2023 10:30:00 GMT+0000`
  - Local format: `12/25/2023 10:30:00`
  - Simple dates: `2023-12-25`
- Smart deduplication to avoid duplicate results
- Progress indication for large files
- Safety warnings for files exceeding size thresholds
- Results can be opened side-by-side or replace current document
- Optional clipboard copying

**Output Format**:

Dates are extracted in their original format, one per line:

```
2023-12-25T10:30:00.000Z
Mon, 25 Dec 2023 10:30:00 GMT
1703508600
2023-12-25
```

**Configuration**:

- `dates-le.copyToClipboardEnabled` - Auto-copy results to clipboard
- `dates-le.dedupeEnabled` - Remove duplicate dates
- `dates-le.openResultsSideBySide` - Open results in side-by-side editor
- `dates-le.safety.enabled` - Enable safety checks for large files

**Error Handling**:

- Gracefully handles invalid date formats
- Provides clear error messages for parsing failures
- Continues processing despite individual date errors
- Shows helpful messages when no dates are found

## Settings Commands

### 2. Open Settings (`dates-le.openSettings`)

**Purpose**: Quick access to Dates-LE settings in VS Code.

**Usage**:

- **Command Palette**: `Dates-LE: Open Settings`

**Details**: Opens VS Code settings filtered to Dates-LE configuration options.

### 3. Export Settings (`dates-le.settings.export`)

**Purpose**: Export current Dates-LE settings to a JSON file.

**Usage**:

- **Command Palette**: `Dates-LE: Export Settings`

**Features**:

- Saves all Dates-LE configuration to a JSON file
- Includes version and export timestamp
- Useful for backing up configuration or sharing with team

**Output Format**:

```json
{
  "version": "1.0.0",
  "exportedAt": "2023-12-25T10:30:00.000Z",
  "settings": {
    "copyToClipboardEnabled": false,
    "dedupeEnabled": false,
    "notificationsLevel": "silent",
    ...
  }
}
```

### 4. Import Settings (`dates-le.settings.import`)

**Purpose**: Import Dates-LE settings from a previously exported JSON file.

**Usage**:

- **Command Palette**: `Dates-LE: Import Settings`

**Features**:

- Validates imported settings file format
- Confirms before overwriting current settings
- Provides clear success/failure feedback

**Safety**: Shows confirmation dialog before applying imported settings.

### 5. Reset Settings (`dates-le.settings.reset`)

**Purpose**: Reset all Dates-LE settings to their default values.

**Usage**:

- **Command Palette**: `Dates-LE: Reset Settings`

**Features**:

- Resets all configuration to defaults
- Shows confirmation dialog (cannot be undone)
- Provides clear feedback on completion

**Safety**: Requires explicit confirmation before resetting.

### 6. Help & Troubleshooting (`dates-le.help`)

**Purpose**: Quick access to Dates-LE documentation and troubleshooting resources.

**Usage**:

- **Command Palette**: `Dates-LE: Help & Troubleshooting`

**Features**:

- Links to online documentation
- Common troubleshooting tips
- GitHub issues for support

## Command Availability

All commands are available when:

- A supported file type is open (JSON, YAML, CSV)
- VS Code is in a trusted workspace
- The extension is activated

## Keyboard Shortcuts

| Command       | Windows/Linux | macOS       |
| ------------- | ------------- | ----------- |
| Extract Dates | `Ctrl+Alt+D`  | `Cmd+Alt+D` |

**Note**: Keyboard shortcuts can be customized in VS Code's keyboard shortcuts settings (`Ctrl+K Ctrl+S` or `Cmd+K Cmd+S`).

## Error Messages

Common error messages and their meanings:

| Message                                  | Meaning                                     | Solution                                      |
| ---------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| "No active editor found"                 | No file is currently open                   | Open a JSON, YAML, or CSV file                |
| "No dates found in the current document" | Document doesn't contain recognizable dates | Verify file contains valid date formats       |
| "Failed to extract dates"                | Parsing error occurred                      | Check file is valid JSON/YAML/CSV format      |
| "File size exceeds threshold"            | File is large (>1MB by default)             | Confirm to proceed or adjust safety threshold |
| "Results too large for clipboard"        | Output exceeds 1MB                          | Disable clipboard copy or reduce file size    |

## Best Practices

1. **File Format**: Ensure files are valid JSON, YAML, or CSV before extraction
2. **Large Files**: Enable safety warnings to get alerts for large files
3. **Performance**: For files >10MB, consider splitting into smaller chunks
4. **Deduplication**: Enable if working with files that may contain duplicate dates
5. **Side-by-Side**: Use side-by-side viewing to compare extracted dates with source

## Related Documentation

- [Configuration Guide](./CONFIGURATION.md) - Detailed configuration options
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Performance Guide](./PERFORMANCE.md) - Optimization tips for large files
