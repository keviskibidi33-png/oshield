package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ozyshield/ozyshield-server/internal/config"
	"github.com/ozyshield/ozyshield-server/internal/db"
	"github.com/ozyshield/ozyshield-server/internal/engine"
)

// ServerAPI encapsulates the store and diagnostics cache for API handlers.
type ServerAPI struct {
	Store db.Store
	Cache *engine.DiagnosticsCache
	teams *TeamStore
	users *UserStore
	Cfg   *config.Config
}

// NewServerAPI initializes a ServerAPI instance.
func NewServerAPI(store db.Store, cache *engine.DiagnosticsCache, cfg *config.Config) *ServerAPI {
	return &ServerAPI{
		Store: store,
		Cache: cache,
		teams: NewTeamStore(),
		users: NewUserStore(cfg),
		Cfg:   cfg,
	}
}

// StartUptimeRecorder runs a background goroutine that records node uptime every hour.
func (api *ServerAPI) StartUptimeRecorder() {
	go func() {
		// Record immediately on startup
		api.recordUptimeSnapshot()

		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			api.recordUptimeSnapshot()
		}
	}()
	log.Println("[Server] Uptime recorder started (hourly)")
}

func (api *ServerAPI) recordUptimeSnapshot() {
	nodes, err := api.Store.ListNodes()
	if err != nil {
		log.Printf("[Uptime] Failed to list nodes: %v", err)
		return
	}

	nodeStatus := make(map[string]bool)
	now := time.Now()
	for _, n := range nodes {
		// Node is online if last_seen within last 5 minutes
		isOnline := now.Sub(n.LastSeen) < 5*time.Minute
		nodeStatus[n.NodeID] = isOnline

		// Refresh last_seen for seed/demo nodes so they stay online
		if isOnline {
			api.Store.UpdateNodeLastSeen(n.NodeID)
		}
	}

	onlineCount := 0
	for _, online := range nodeStatus {
		if online {
			onlineCount++
		}
	}

	record := db.UptimeRecord{
		Timestamp:   now,
		NodeStatus:  nodeStatus,
		OnlineCount: onlineCount,
		TotalCount:  len(nodes),
	}

	if err := api.Store.RecordUptime(record); err != nil {
		log.Printf("[Uptime] Failed to record uptime: %v", err)
		return
	}
	log.Printf("[Uptime] Snapshot recorded: %d/%d nodes online", onlineCount, len(nodes))
}

// GetInstallScript serves the install.sh script dynamically, injecting the token if provided.
func (api *ServerAPI) GetInstallScript(w http.ResponseWriter, r *http.Request) {
	installPath := "install.sh"

	content, err := os.ReadFile(installPath)
	if err != nil {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("Error: Universal install.sh script not found on server disk."))
		return
	}

	script := string(content)

	// Bake token dynamically if provided in query ?token=YOUR_TOKEN
	token := r.URL.Query().Get("token")
	if token != "" {
		// Clean and replace the placeholder OZY_CLIENT_TOKEN="" in the script
		script = strings.Replace(script, `OZY_CLIENT_TOKEN=""`, `OZY_CLIENT_TOKEN="`+token+`"`, 1)
	}

	w.Header().Set("Content-Type", "text/x-shellscript")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(script))
}

// RegisterDiscovery registers VM system mapping metrics sent by the agent.
func (api *ServerAPI) RegisterDiscovery(w http.ResponseWriter, r *http.Request) {
	type DiscoveryPayload struct {
		ClientToken string `json:"client_token"`
		NodeID      string `json:"node_id"`
		SystemMap   struct {
			Hostname  string            `json:"hostname"`
			IP        string            `json:"ip,omitempty"`
			OS        string            `json:"os"`
			Platform  string            `json:"platform"`
			CPUCount  int               `json:"cpu_count"`
			Services  map[string]string `json:"services"`
			Timestamp time.Time         `json:"timestamp"`
		} `json:"system_map"`
	}

	var payload DiscoveryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if payload.NodeID == "" {
		http.Error(w, "Missing node_id parameter", http.StatusBadRequest)
		return
	}

	node := db.Node{
		NodeID:   payload.NodeID,
		Name:     payload.SystemMap.Hostname,
		IP:       payload.SystemMap.IP,
		OS:       payload.SystemMap.OS,
		Platform: payload.SystemMap.Platform,
		CPUCount: payload.SystemMap.CPUCount,
		Services: payload.SystemMap.Services,
	}

	if err := api.Store.RegisterNode(node); err != nil {
		http.Error(w, "Failed to register node: "+err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("[Server] Registered discovery mapping for Node ID: %s (OS: %s)", node.NodeID, node.OS)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "registered"})
}

// IngestTelemetry receives log error strings, runs the cache search, invokes diagnosis, and records incidents.
func (api *ServerAPI) IngestTelemetry(w http.ResponseWriter, r *http.Request) {
	type TelemetryPayload struct {
		ClientToken string    `json:"client_token"`
		NodeID      string    `json:"node_id"`
		LogLine     string    `json:"log_line"`
		Service     string    `json:"service"`
		Timestamp   time.Time `json:"timestamp"`
	}

	var payload TelemetryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if payload.NodeID == "" || payload.LogLine == "" {
		http.Error(w, "Missing node_id or log_line parameters", http.StatusBadRequest)
		return
	}

	// 1. Check if diagnosis is cached
	diag, found := api.Cache.Get(payload.LogLine)
	if !found {
		// Log cache miss and trigger analysis engine
		log.Printf("[Server] Cache miss for log line: %s. Performing analysis...", payload.LogLine[:min(len(payload.LogLine), 40)])
		diag = engine.AnalyzeLog(payload.LogLine, payload.Service, api.Cfg.MistralAPIKey, api.Cfg.MistralModel)
		api.Cache.Set(payload.LogLine, diag)
	} else {
		log.Printf("[Server] Cache hit for log line: %s. Serving cached diagnosis.", payload.LogLine[:min(len(payload.LogLine), 40)])
	}

	// Determine diagnosis source
	diagSource := "heuristic"
	if api.Cfg.MistralAPIKey != "" {
		diagSource = "ai"
	}

	// 2. Calculate log hash for reoccurrence detection
	logHash := engine.HashLogLine(payload.LogLine)

	// 3. Check for reoccurrence within configured window
	window := time.Duration(api.Cfg.ReoccurrenceWindowMin) * time.Minute
	existing, err := api.Store.FindResolvedIncidentByHash(logHash, window)
	if err == nil && existing != nil {
		// Reopen the existing incident
		log.Printf("[Server] Reoccurrence detected! Reopening incident %s (hash match)", existing.ID)
		reopened, reopenErr := api.Store.ReopenIncident(existing.ID)
		if reopenErr != nil {
			log.Printf("[Server] Failed to reopen incident: %v", reopenErr)
		} else {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			json.NewEncoder(w).Encode(reopened)
			return
		}
	}

	// 4. No reoccurrence found - create new incident
	incidentID := "inc_" + time.Now().Format("20060102150405") + "_" + strings.ToLower(payload.NodeID[:min(len(payload.NodeID), 4)])
	incident := db.Incident{
		ID:              incidentID,
		Title:           diag.Title,
		NodeID:          payload.NodeID,
		LogLine:         payload.LogLine,
		Service:         payload.Service,
		Diagnosis:       diag.Cause,
		DiagnosisSource: diagSource,
		Remediation:     diag.Steps,
		Status:          "critical",
		Timestamp:       payload.Timestamp,
		LogHash:         logHash,
	}

	// 5. Register incident in DB
	savedIncident, err := api.Store.AddIncident(incident)
	if err != nil {
		http.Error(w, "Failed to save incident: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(savedIncident)
}

// ListNodes serves a list of all registered VM nodes.
func (api *ServerAPI) ListNodes(w http.ResponseWriter, r *http.Request) {
	nodes, err := api.Store.ListNodes()
	if err != nil {
		http.Error(w, "Failed to list nodes: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nodes)
}

// ListIncidents serves a list of all telemetry incidents.
func (api *ServerAPI) ListIncidents(w http.ResponseWriter, r *http.Request) {
	incidents, err := api.Store.ListIncidents()
	if err != nil {
		http.Error(w, "Failed to list incidents: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(incidents)
}

// SimulateCrash acts as a webhook helper, allowing the dashboard web frontend to trigger a mock telemetry crash.
func (api *ServerAPI) SimulateCrash(w http.ResponseWriter, r *http.Request) {
	log.Println("[Server] Received manual simulation request: database_lock_timeout")

	// Trigger mock postgresql telemetry log
	logLine := "[CRITICAL] postgresql database query failed: lock timeout after 10000ms. transaction blocked."
	diag := engine.AnalyzeLog(logLine, "postgresql", api.Cfg.MistralAPIKey, api.Cfg.MistralModel)

	diagSource := "heuristic"
	if api.Cfg.MistralAPIKey != "" {
		diagSource = "ai"
	}

	logHash := engine.HashLogLine(logLine)
	incidentID := "inc_sim_" + time.Now().Format("150405")
	incident := db.Incident{
		ID:              incidentID,
		Title:           diag.Title,
		NodeID:          "vm-primary-postgres",
		LogLine:         logLine,
		Service:         "postgresql",
		Diagnosis:       diag.Cause,
		DiagnosisSource: diagSource,
		Remediation:     diag.Steps,
		Status:          "critical",
		Timestamp:       time.Now(),
		LogHash:         logHash,
	}

	savedIncident, err := api.Store.AddIncident(incident)
	if err != nil {
		http.Error(w, "Failed to save simulated incident: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(savedIncident)
}

// UpdateIncidentStatus allows changing an incident's status (acknowledged, resolved, annulled).
func (api *ServerAPI) UpdateIncidentStatus(w http.ResponseWriter, r *http.Request) {
	type StatusPayload struct {
		Status string `json:"status"`
	}

	var payload StatusPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if payload.Status != "acknowledged" && payload.Status != "resolved" && payload.Status != "critical" && payload.Status != "annulled" {
		http.Error(w, "Invalid status. Must be: critical, acknowledged, resolved, or annulled", http.StatusBadRequest)
		return
	}

	incidentID := r.PathValue("id")
	if incidentID == "" {
		http.Error(w, "Missing incident ID", http.StatusBadRequest)
		return
	}

	updated, err := api.Store.UpdateIncident(incidentID, payload.Status)
	if err != nil {
		http.Error(w, "Incident not found: "+err.Error(), http.StatusNotFound)
		return
	}

	log.Printf("[Server] Incident %s status updated to '%s'", incidentID, payload.Status)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updated)
}

// AssignIncidentToTeam assigns an incident to a specific team.
func (api *ServerAPI) AssignIncidentToTeam(w http.ResponseWriter, r *http.Request) {
	type TeamPayload struct {
		Team string `json:"team"`
	}

	var payload TeamPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if payload.Team == "" {
		http.Error(w, "Missing team name", http.StatusBadRequest)
		return
	}

	incidentID := r.PathValue("id")
	if incidentID == "" {
		http.Error(w, "Missing incident ID", http.StatusBadRequest)
		return
	}

	updated, err := api.Store.UpdateIncidentTeam(incidentID, payload.Team)
	if err != nil {
		http.Error(w, "Incident not found: "+err.Error(), http.StatusNotFound)
		return
	}

	log.Printf("[Server] Incident %s assigned to team '%s'", incidentID, payload.Team)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updated)
}

// Heartbeat receives agent liveness signals and updates the node's last_seen timestamp.
func (api *ServerAPI) Heartbeat(w http.ResponseWriter, r *http.Request) {
	type HeartbeatPayload struct {
		ClientToken string `json:"client_token"`
		NodeID      string `json:"node_id"`
	}

	var payload HeartbeatPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if payload.NodeID == "" {
		http.Error(w, "Missing node_id parameter", http.StatusBadRequest)
		return
	}

	// Update last_seen timestamp for the node
	if err := api.Store.UpdateNodeLastSeen(payload.NodeID); err != nil {
		// Node might not exist yet, that's okay
		log.Printf("[Server] Heartbeat for unknown node: %s", payload.NodeID)
	} else {
		log.Printf("[Server] Heartbeat received from node: %s", payload.NodeID)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ReanalyzeIncident re-runs AI diagnosis on an existing incident.
func (api *ServerAPI) ReanalyzeIncident(w http.ResponseWriter, r *http.Request) {
	incidentID := r.PathValue("id")
	if incidentID == "" {
		http.Error(w, "Missing incident ID", http.StatusBadRequest)
		return
	}

	// Find the incident
	incidents, err := api.Store.ListIncidents()
	if err != nil {
		http.Error(w, "Failed to list incidents", http.StatusInternalServerError)
		return
	}

	var target *db.Incident
	for _, inc := range incidents {
		if inc.ID == incidentID {
			target = &inc
			break
		}
	}
	if target == nil {
		http.Error(w, "Incident not found", http.StatusNotFound)
		return
	}

	// Force fresh AI analysis (bypass cache)
	log.Printf("[Server] Re-analyzing incident %s with AI (log: %s...)", incidentID, target.LogLine[:min(len(target.LogLine), 40)])
	diag := engine.AnalyzeLog(target.LogLine, target.Service, api.Cfg.MistralAPIKey, api.Cfg.MistralModel)

	// Determine source
	source := "heuristic"
	if api.Cfg.MistralAPIKey != "" {
		source = "reanalyzed"
	}

	// Update the incident
	updated, err := api.Store.UpdateIncidentDiagnosis(incidentID, diag.Title, diag.Cause, source, diag.Steps)
	if err != nil {
		http.Error(w, "Failed to update incident: "+err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("[Server] Incident %s re-analyzed. Source: %s, Title: %s", incidentID, source, diag.Title)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updated)
}

// GetUptimeHistory returns hourly uptime records for the last N hours.
func (api *ServerAPI) GetUptimeHistory(w http.ResponseWriter, r *http.Request) {
	hoursStr := r.URL.Query().Get("hours")
	hours := 24 // default 24 hours
	if hoursStr != "" {
		if h, err := strconv.Atoi(hoursStr); err == nil && h > 0 && h <= 168 {
			hours = h
		}
	}

	records, err := api.Store.GetUptimeHistory(hours)
	if err != nil {
		http.Error(w, "Failed to fetch uptime history: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(records)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// IngestAlert receives suspicious pattern alerts from agents.
func (api *ServerAPI) IngestAlert(w http.ResponseWriter, r *http.Request) {
	type AlertPayload struct {
		ClientToken string    `json:"client_token"`
		NodeID      string    `json:"node_id"`
		Pattern     string    `json:"pattern"`
		Category    string    `json:"category"`
		Severity    string    `json:"severity"`
		LogLine     string    `json:"log_line"`
		Service     string    `json:"service"`
		Timestamp   time.Time `json:"timestamp"`
	}

	var payload AlertPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if payload.NodeID == "" || payload.Pattern == "" {
		http.Error(w, "Missing node_id or pattern parameters", http.StatusBadRequest)
		return
	}

	alert := db.Alert{
		NodeID:    payload.NodeID,
		Pattern:   payload.Pattern,
		Category:  payload.Category,
		Severity:  payload.Severity,
		LogLine:   payload.LogLine,
		Service:   payload.Service,
		Timestamp: payload.Timestamp,
	}

	savedAlert, err := api.Store.AddAlert(alert)
	if err != nil {
		http.Error(w, "Failed to save alert: "+err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("[Server] Suspicious pattern alert received: %s from node %s", payload.Pattern, payload.NodeID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(savedAlert)
}

// ListAlerts serves a list of all suspicious pattern alerts.
func (api *ServerAPI) ListAlerts(w http.ResponseWriter, r *http.Request) {
	alerts, err := api.Store.ListAlerts()
	if err != nil {
		http.Error(w, "Failed to list alerts: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alerts)
}