package api

import (
	"net/http"
)

// RegisterRoutes binds our endpoints to the Go 1.22+ standard multiplexer.
func RegisterRoutes(mux *http.ServeMux, api *ServerAPI) {
	// 1. Agent-facing endpoints
	mux.HandleFunc("GET /v1/install.sh", corsMiddleware(api.GetInstallScript))
	mux.HandleFunc("POST /v1/discovery", corsMiddleware(api.RegisterDiscovery))
	mux.HandleFunc("POST /v1/telemetry", corsMiddleware(api.IngestTelemetry))
	mux.HandleFunc("POST /v1/heartbeat", corsMiddleware(api.Heartbeat))

	// 2. Client Dashboard-facing endpoints
	mux.HandleFunc("GET /v1/nodes", corsMiddleware(api.ListNodes))
	mux.HandleFunc("GET /v1/incidents", corsMiddleware(api.ListIncidents))
	mux.HandleFunc("PUT /v1/incidents/{id}", corsMiddleware(api.UpdateIncidentStatus))
	mux.HandleFunc("PUT /v1/incidents/{id}/team", corsMiddleware(api.AssignIncidentToTeam))
	mux.HandleFunc("POST /v1/incidents/{id}/reanalyze", corsMiddleware(api.ReanalyzeIncident))
	mux.HandleFunc("POST /v1/simulate-crash", corsMiddleware(api.SimulateCrash))
	mux.HandleFunc("GET /v1/uptime", corsMiddleware(api.GetUptimeHistory))

	// 3. Teams endpoints
	mux.HandleFunc("GET /v1/teams", corsMiddleware(api.ListTeams))
	mux.HandleFunc("POST /v1/teams", corsMiddleware(api.CreateTeam))
	mux.HandleFunc("PUT /v1/teams/{id}", corsMiddleware(api.UpdateTeam))
	mux.HandleFunc("DELETE /v1/teams/{id}", corsMiddleware(api.DeleteTeam))

	// 5. Users endpoints
	mux.HandleFunc("POST /v1/auth/login", corsMiddleware(api.Login))
	mux.HandleFunc("POST /v1/auth/validate", corsMiddleware(api.ValidateToken))
	mux.HandleFunc("GET /v1/config", corsMiddleware(api.GetConfig))
	mux.HandleFunc("GET /v1/users", corsMiddleware(api.ListUsers))
	mux.HandleFunc("GET /v1/users/me", corsMiddleware(api.GetCurrentUser))
	mux.HandleFunc("POST /v1/users/switch", corsMiddleware(api.SwitchUser))
	mux.HandleFunc("POST /v1/users", corsMiddleware(api.CreateUser))
	mux.HandleFunc("PUT /v1/users/{id}", corsMiddleware(api.UpdateUser))
	mux.HandleFunc("DELETE /v1/users/{id}", corsMiddleware(api.DeleteUser))

	// 5. Invitations endpoints
	mux.HandleFunc("GET /v1/invitations", corsMiddleware(api.ListInvitations))
	mux.HandleFunc("POST /v1/invitations", corsMiddleware(api.CreateInvitation))
	mux.HandleFunc("PUT /v1/invitations/{id}", corsMiddleware(api.RespondInvitation))
}

// corsMiddleware injects standard CORS headers to permit local and production frontend origins to fetch data.
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Allow any origin for development/local integration flexibility.
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight OPTIONS requests directly
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}