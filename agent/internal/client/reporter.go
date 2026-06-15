package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// TelemetryPayload represents the JSON body sent to the central OzyShield API.
type TelemetryPayload struct {
	ClientToken string    `json:"client_token"`
	NodeID      string    `json:"node_id"`
	LogLine     string    `json:"log_line"`
	Service     string    `json:"service"`
	Timestamp   time.Time `json:"timestamp"`
}

// Report sends a single telemetry log line payload to the central API server.
func Report(ctx context.Context, serverURL string, payload TelemetryPayload) error {
	url := fmt.Sprintf("%s/v1/telemetry", serverURL)

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal telemetry payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", payload.ClientToken))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to dispatch HTTP post: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("server returned non-OK status: %s", resp.Status)
	}

	return nil
}

// ReportDiscovery registers the node specifications and system details with the central API server.
func ReportDiscovery(ctx context.Context, serverURL string, clientToken string, nodeID string, sysMap interface{}) error {
	url := fmt.Sprintf("%s/v1/discovery", serverURL)

	// Wrap payload to match Server expects
	payload := struct {
		ClientToken string      `json:"client_token"`
		NodeID      string      `json:"node_id"`
		SystemMap   interface{} `json:"system_map"`
	}{
		ClientToken: clientToken,
		NodeID:      nodeID,
		SystemMap:   sysMap,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal discovery payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", clientToken))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to dispatch HTTP post: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("server returned non-OK status: %s", resp.Status)
	}

	return nil
}