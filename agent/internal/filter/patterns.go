package filter

import "regexp"

// SuspiciousPattern represents a known attack pattern detected in logs.
type SuspiciousPattern struct {
	Name     string `json:"name"`
	Regex    string `json:"-"`
	Severity string `json:"severity"`
	Category string `json:"category"`
}

// SuspiciousMatch is the result of matching a log line against suspicious patterns.
type SuspiciousMatch struct {
	Name     string `json:"name"`
	Severity string `json:"severity"`
	Category string `json:"category"`
}

// SuspiciousPatterns defines the list of known attack signatures to detect.
var SuspiciousPatterns = []SuspiciousPattern{
	{
		Name:     "SQL Injection Attempt",
		Regex:    `(?i)(union\s+select|or\s+1\s*=\s*1|drop\s+table|insert\s+into.*values|delete\s+from.*where)`,
		Severity: "warning",
		Category: "injection",
	},
	{
		Name:     "Command Injection",
		Regex:    `(?i)(;\s*cat\s+/|;\s*wget\s+|;\s*curl\s+|` + "`" + `.*` + "`" + `|\$\(|\bexec\s*\()`,
		Severity: "warning",
		Category: "injection",
	},
	{
		Name:     "Privilege Escalation",
		Regex:    `(?i)(sudo\s+su|chmod\s+777|chown\s+root|setuid|/etc/shadow|chmod\s+\+s)`,
		Severity: "warning",
		Category: "privilege",
	},
	{
		Name:     "Reverse Shell Pattern",
		Regex:    `(?i)(bash\s+-i|nc\s+-e|/dev/tcp|python.*socket|perl.*socket|ruby.*socket)`,
		Severity: "warning",
		Category: "malware",
	},
	{
		Name:     "Crypto Miner Signature",
		Regex:    `(?i)(stratum\+tcp|xmrig|cryptonight|coinhive|monero|minerd|pool\.*)`,
		Severity: "warning",
		Category: "malware",
	},
	{
		Name:     "Unauthorized File Access",
		Regex:    `(?i)(cat\s+/etc/passwd|cat\s+/etc/shadow|wget.*\.sh|curl.*\.sh\s*\|\s*bash|chmod\s+777\s+/)`,
		Severity: "warning",
		Category: "access",
	},
	{
		Name:     "Container Escape Attempt",
		Regex:    `(?i)(docker\s+run.*--privileged|nsenter.*--target.*--mount|/proc/1/ns|docker\s+run.*--pid=host)`,
		Severity: "warning",
		Category: "container",
	},
	{
		Name:     "SSH Brute Force",
		Regex:    `(?i)(failed\s+password|authentication\s+failure).*(?:ssh|sshd)`,
		Severity: "warning",
		Category: "brute_force",
	},
	{
		Name:     "Port Scan Detected",
		Regex:    `(?i)(connection\s+refused|no\s+route\s+to\s+host).*(?:port\s+\d+|syn\s+scan)`,
		Severity: "warning",
		Category: "recon",
	},
	{
		Name:     "Data Exfiltration",
		Regex:    `(?i)(curl.*\|.*base64|wget.*\|.*base64|data\s+exfiltration|nc\s+.*-w\s+\d+)`,
		Severity: "warning",
		Category: "exfiltration",
	},
}

// DetectSuspiciousPatterns checks a log line against all known suspicious patterns.
func DetectSuspiciousPatterns(line string) []SuspiciousMatch {
	var matches []SuspiciousMatch
	for _, p := range SuspiciousPatterns {
		re, err := regexp.Compile(p.Regex)
		if err != nil {
			continue
		}
		if re.MatchString(line) {
			matches = append(matches, SuspiciousMatch{
				Name:     p.Name,
				Severity: p.Severity,
				Category: p.Category,
			})
		}
	}
	return matches
}
