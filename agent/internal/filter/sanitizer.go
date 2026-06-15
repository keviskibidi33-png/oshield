package filter

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	// Email regex
	emailRegex = regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)

	// Potential card regex: matches sequences of 13 to 19 digits, possibly separated by spaces or dashes
	cardRegex = regexp.MustCompile(`\b(?:\d[ -]*?){13,19}\b`)

	// Credentials regex for configuration files / environment properties
	credsRegex = regexp.MustCompile(`(?i)(password|passwd|secret|api_key|token|auth|authorization|private_key|passphrase)\s*[:=]\s*["']?([^\s"';,]+)["']?`)

	// Bearer authorization token regex
	bearerRegex = regexp.MustCompile(`(?i)bearer\s+([a-zA-Z0-9\-._~+/]+=*)`)

	// DB URI credentials regex: matches schemas like postgresql://user:pass@host:port/db
	dbURIRegex = regexp.MustCompile(`(?i)([a-z0-9+.-]+)://([^:\s]+):([^@\s]+)@([^\s]+)`)
)

// Luhn check algorithm to validate credit card numbers and reduce false positives.
func isValidLuhn(s string) bool {
	// Remove non-digit characters
	cleaned := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			cleaned = append(cleaned, s[i])
		}
	}

	if len(cleaned) < 13 || len(cleaned) > 19 {
		return false
	}

	sum := 0
	alternate := false
	for i := len(cleaned) - 1; i >= 0; i-- {
		digit, _ := strconv.Atoi(string(cleaned[i]))
		if alternate {
			digit *= 2
			if digit > 9 {
				digit -= 9
			}
		}
		sum += digit
		alternate = !alternate
	}

	return sum%10 == 0
}

// Sanitize removes sensitive personal data and secrets from log lines.
func Sanitize(input string) string {
	if input == "" {
		return ""
	}

	// 1. Redact DB connection credentials FIRST (keeps endpoints and hides @ signs to avoid email false positives)
	sanitized := dbURIRegex.ReplaceAllStringFunc(input, func(match string) string {
		submatches := dbURIRegex.FindStringSubmatch(match)
		if len(submatches) >= 5 {
			scheme := submatches[1]
			hostPart := submatches[4]
			return scheme + "://[REDACTED_USER]:[REDACTED_PASSWORD]@" + hostPart
		}
		return match
	})

	// 2. Redact Bearer Authorization tokens
	sanitized = bearerRegex.ReplaceAllStringFunc(sanitized, func(match string) string {
		submatches := bearerRegex.FindStringSubmatch(match)
		if len(submatches) >= 2 {
			return "Bearer [REDACTED_TOKEN]"
		}
		return match
	})

	// 3. Redact config secrets and passwords (skip if value is "bearer")
	sanitized = credsRegex.ReplaceAllStringFunc(sanitized, func(match string) string {
		submatches := credsRegex.FindStringSubmatch(match)
		if len(submatches) >= 3 {
			val := submatches[2]
			if strings.ToLower(val) == "bearer" {
				return match
			}
			return strings.Replace(match, val, "[REDACTED_SECRET]", 1)
		}
		return match
	})

	// 4. Redact Credit Cards (apply Luhn algorithm validation first)
	sanitized = cardRegex.ReplaceAllStringFunc(sanitized, func(match string) string {
		if isValidLuhn(match) {
			return "[REDACTED_CARD]"
		}
		return match
	})

	// 5. Redact emails (run last so we don't accidentally match DB URIs)
	sanitized = emailRegex.ReplaceAllString(sanitized, "[REDACTED_EMAIL]")

	return sanitized
}