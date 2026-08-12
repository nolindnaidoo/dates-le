package handler

// Released 2024-01-15; the deprecation lands on 2024-06-01T00:00:00Z.
const (
	released   = "2024-01-15"
	deprecated = "2024-06-01T00:00:00Z"
)

// What time.UnixNano() prints, which no reviewer reads as a date.
const observedAt = 1705314645123456789

// A constructor argument is a date in JavaScript and a string here, so
// the fallback leaves it alone.
var note = "new Date('March 5, 2024')"
