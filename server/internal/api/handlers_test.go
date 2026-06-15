package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ozyshield/ozyshield-server/internal/db"
	"github.com/ozyshield/ozyshield-server/internal/engine"
)

func TestIngestTelemetry(t *testing.T) {
	store := db.NewMemoryStore()
	cache := engine.NewDiagnosticsCache()
	serverAPI := NewServerAPI(store, cache)

	// Create test HTTP server ServeMux
	mux := http.NewServeMux()
	RegisterRoutes(mux, serverAPI)

	// Payload with standard Postgres lock timeout log
	logLine := "[CRITICAL] postgresql database query failed: lock timeout after 10000ms. transaction blocked."
	payload := map[string]interface{}{
		"client_token": "test-token",
		"node_id":      "test-node-123",
		"log_line":     logLine,
		"service":      "postgresql",
		"timestamp":    time.Now().Format(time.RFC3339),
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/v1/telemetry", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	// Verify status
	if w.Code != http.StatusAccepted {
		t.Errorf("Expected status 202 Accepted, got %d", w.Code)
	}

	// Verify response body contains the diagnosis
	var incident db.Incident
	if err := json.Unmarshal(w.Body.Bytes(), &incident); err != nil {
		t.Fatalf("Failed to parse incident response: %v", err)
	}

	if incident.NodeID != "test-node-123" {
		t.Errorf("Expected node_id test-node-123, got %s", incident.NodeID)
	}

	if incident.Diagnosis == "" {
		t.Errorf("Expected non-empty diagnosis cause")
	}

	// Verify CORS headers
	corsOrigin := w.Header().Get("Access-Control-Allow-Origin")
	if corsOrigin != "*" {
		t.Errorf("Expected Access-Control-Allow-Origin to be '*', got %q", corsOrigin)
	}
}
