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

	// 2. Client Dashboard-facing endpoints
	mux.HandleFunc("GET /v1/nodes", corsMiddleware(api.ListNodes))
	mux.HandleFunc("GET /v1/incidents", corsMiddleware(api.ListIncidents))
	mux.HandleFunc("POST /v1/simulate-crash", corsMiddleware(api.SimulateCrash))
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