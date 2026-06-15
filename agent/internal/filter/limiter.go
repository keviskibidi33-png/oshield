package filter

import (
	"sync"
	"time"
)

// RateLimiter protects against log flooding and duplicate errors.
type RateLimiter struct {
	mu           sync.Mutex
	tokens       float64
	capacity     float64
	refillRate   float64   // tokens per second
	lastRefill   time.Time

	dedupWindow  time.Duration
	seenLogs     map[string]time.Time
}

// NewRateLimiter initializes a rate limiter with token bucket capacity, refill rate, and deduplication window.
func NewRateLimiter(capacity float64, refillRate float64, dedupWindow time.Duration) *RateLimiter {
	return &RateLimiter{
		tokens:      capacity,
		capacity:    capacity,
		refillRate:  refillRate,
		lastRefill:  time.Now(),
		dedupWindow: dedupWindow,
		seenLogs:    make(map[string]time.Time),
	}
}

// getSignature extracts the first 64 characters of a log line to serve as a signature for deduplication.
func (rl *RateLimiter) getSignature(line string) string {
	if len(line) <= 64 {
		return line
	}
	return line[:64]
}

// cleanExpiredSignatures removes expired entries from seenLogs to prevent memory leaks.
func (rl *RateLimiter) cleanExpiredSignatures(now time.Time) {
	for sig, timestamp := range rl.seenLogs {
		if now.Sub(timestamp) > rl.dedupWindow {
			delete(rl.seenLogs, sig)
		}
	}
}

// Allow checks if a log line is allowed under rate limits and deduplication rules.
func (rl *RateLimiter) Allow(line string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// 1. Clean up old signatures periodically
	rl.cleanExpiredSignatures(now)

	// 2. Perform Deduplication check
	sig := rl.getSignature(line)
	if lastSeen, found := rl.seenLogs[sig]; found {
		if now.Sub(lastSeen) < rl.dedupWindow {
			// Update the last seen timestamp to slide the window (or keep it fixed, sliding is standard)
			rl.seenLogs[sig] = now
			return false // Suppress duplicates
		}
	}
	rl.seenLogs[sig] = now

	// 3. Token Bucket Rate Limiting
	// Refill tokens based on elapsed time
	elapsed := now.Sub(rl.lastRefill).Seconds()
	rl.lastRefill = now
	rl.tokens += elapsed * rl.refillRate
	if rl.tokens > rl.capacity {
		rl.tokens = rl.capacity
	}

	// Try to consume 1 token
	if rl.tokens >= 1.0 {
		rl.tokens -= 1.0
		return true // Allowed
	}

	return false // Rate-limited
}