"""Retention policy, pinned to real dates rather than a rolling window."""

# The cutover, written three ways in one file — which is the problem
# this tool exists for.
CUTOVER_DATE = "2024-01-15"
CUTOVER_ISO = "2024-01-15T10:30:45Z"
CUTOVER_EPOCH = 1705314645

# Not dates: a port, a timeout, a version.
PORT = 8080
TIMEOUT_SECONDS = 30
VERSION = "3.12.1"

# A syslog line is a date in a log file and three words here. The
# fallback runs the shared patterns and only those, so it is not read.
LOG_PREFIX = "Jan 15 10:30:47"

# The fraction of a float is a digit run of any length, and sixteen of
# them are microseconds. This is a real constant, not a timestamp.
Z_95 = 1.6448536269514722
