package filter

import (
	"testing"
	"time"
)

func TestRateLimiter_Deduplication(t *testing.T) {
	// 3 token capacity, 1 refill per second, 150ms deduplication window
	limiter := NewRateLimiter(3.0, 1.0, 150*time.Millisecond)

	// These two logs share the exact same first 64 characters prefix
	log1 := "[ERROR] Connection lost on postgresql database: connection failed at 10:00:00 AM"
	log2 := "[ERROR] Connection lost on postgresql database: connection failed at 10:00:01 AM"

	// First occurrence: should be allowed
	if !limiter.Allow(log1) {
		t.Errorf("Expected first log occurrence to be allowed")
	}

	// Immediate duplicate (shares same 64-char signature): should be suppressed
	if limiter.Allow(log2) {
		t.Errorf("Expected immediate duplicate log to be suppressed")
	}

	// Sleep to pass the deduplication window
	time.Sleep(200 * time.Millisecond)

	// Now it should be allowed again
	if !limiter.Allow(log1) {
		t.Errorf("Expected duplicate log to be allowed after dedup window elapsed")
	}
}

func TestRateLimiter_TokenBucketLimit(t *testing.T) {
	// 2 token capacity, 0 refill (to isolate token consumption), 0 dedup window
	limiter := NewRateLimiter(2.0, 0.0, 0)

	// Consume token 1
	if !limiter.Allow("Unique error log 1") {
		t.Errorf("Expected token 1 consumption to succeed")
	}

	// Consume token 2
	if !limiter.Allow("Unique error log 2") {
		t.Errorf("Expected token 2 consumption to succeed")
	}

	// Consume token 3 (should fail as bucket is empty)
	if limiter.Allow("Unique error log 3") {
		t.Errorf("Expected token 3 consumption to fail (rate limited)")
	}
}