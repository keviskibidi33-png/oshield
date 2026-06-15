package filter

import (
	"strings"
	"testing"
)

func TestSanitize(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Redact Email",
			input:    "[ERROR] user email is contact@example.com, failed login",
			expected: "[ERROR] user email is [REDACTED_EMAIL], failed login",
		},
		{
			name:     "Redact Valid Credit Card",
			input:    "Failed charge on credit card: 4111-1111-1111-1111", // 4111-1111-1111-1111 is Luhn valid
			expected: "Failed charge on credit card: [REDACTED_CARD]",
		},
		{
			name:     "Do Not Redact Invalid Credit Card",
			input:    "Failed charge on process code: 4111-1111-1111-1112", // 4111-1111-1111-1112 is Luhn invalid
			expected: "Failed charge on process code: 4111-1111-1111-1112",
		},
		{
			name:     "Redact DB URI Connection String",
			input:    "Fatal error: failed to connect to postgresql://postgres:SecretPassword123@db-server.net:5432/production_db",
			expected: "Fatal error: failed to connect to postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@db-server.net:5432/production_db",
		},
		{
			name:     "Redact Configuration Credentials",
			input:    "Loaded configuration API_KEY=\"xyz123_token\" and db_password: adminpassword",
			expected: "Loaded configuration API_KEY=\"[REDACTED_SECRET]\" and db_password: [REDACTED_SECRET]",
		},
		{
			name:     "Redact Bearer Tokens",
			input:    "Authentication failed for authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ",
			expected: "Authentication failed for authorization: Bearer [REDACTED_TOKEN]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Sanitize(tt.input)
			if !strings.Contains(got, tt.expected) && got != tt.expected {
				t.Errorf("Sanitize() = %q, expected %q", got, tt.expected)
			}
		})
	}
}