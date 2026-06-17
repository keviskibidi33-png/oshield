package engine

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"sync"
)

// CachedDiagnosis contains root cause analysis and remediation steps.
type CachedDiagnosis struct {
	Title string   `json:"title"`
	Cause string   `json:"cause"`
	Steps []string `json:"steps"`
}

// DiagnosticsCache manages a thread-safe cache mapping SHA-256 log hashes to diagnoses.
type DiagnosticsCache struct {
	mu      sync.RWMutex
	entries map[string]CachedDiagnosis
}

// NewDiagnosticsCache initializes a DiagnosticsCache.
func NewDiagnosticsCache() *DiagnosticsCache {
	return &DiagnosticsCache{
		entries: make(map[string]CachedDiagnosis),
	}
}

// hash calculates a SHA-256 fingerprint for a given log line after performing basic normalization.
func (dc *DiagnosticsCache) hash(logLine string) string {
	// Normalize log line: strip whitespace, convert to lowercase
	normalized := strings.TrimSpace(strings.ToLower(logLine))

	hasher := sha256.New()
	hasher.Write([]byte(normalized))
	return hex.EncodeToString(hasher.Sum(nil))
}

// Get checks if a diagnosis exists in the cache for the given log line.
func (dc *DiagnosticsCache) Get(logLine string) (CachedDiagnosis, bool) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	h := dc.hash(logLine)
	val, found := dc.entries[h]
	return val, found
}

// Set saves a diagnosis in the cache for the given log line.
func (dc *DiagnosticsCache) Set(logLine string, diag CachedDiagnosis) {
	dc.mu.Lock()
	defer dc.mu.Unlock()

	h := dc.hash(logLine)
	dc.entries[h] = diag
}

// PreSeed directly saves a diagnosis using the log line hash.
func (dc *DiagnosticsCache) PreSeed(logLine string, diag CachedDiagnosis) {
	dc.Set(logLine, diag)
}