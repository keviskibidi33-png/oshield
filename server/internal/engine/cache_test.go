package engine

import (
	"testing"
)

func TestDiagnosticsCache_SetAndGet(t *testing.T) {
	cache := NewDiagnosticsCache()

	logLine := "[CRITICAL] postgresql database query failed: lock timeout after 10000ms"
	diag := CachedDiagnosis{
		Cause: "Database lock conflict",
		Steps: []string{"Kill process", "Inspect locks"},
	}

	// 1. Get before Set -> should be miss
	_, found := cache.Get(logLine)
	if found {
		t.Errorf("Expected cache miss, but got a hit")
	}

	// 2. Set diagnosis
	cache.Set(logLine, diag)

	// 3. Get after Set -> should be hit
	got, found := cache.Get(logLine)
	if !found {
		t.Errorf("Expected cache hit, but got a miss")
	}

	if got.Cause != diag.Cause {
		t.Errorf("Expected cause %q, got %q", diag.Cause, got.Cause)
	}

	if len(got.Steps) != len(diag.Steps) || got.Steps[0] != diag.Steps[0] {
		t.Errorf("Expected steps %v, got %v", diag.Steps, got.Steps)
	}
}
