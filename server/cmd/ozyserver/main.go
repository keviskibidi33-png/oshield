package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	"github.com/ozyshield/ozyshield-server/internal/api"
	"github.com/ozyshield/ozyshield-server/internal/config"
	"github.com/ozyshield/ozyshield-server/internal/db"
	"github.com/ozyshield/ozyshield-server/internal/engine"
)

func main() {
	log.Println("Starting OzyShield Central Server...")

	cfg := config.Load()

	if errs := cfg.Validate(); len(errs) > 0 {
		for _, e := range errs {
			log.Printf("  [ERROR] %s", e)
		}
		log.Fatal("Fix the above configuration errors and restart.")
	}

	portFlag := flag.String("port", cfg.Port, "Port to listen on")
	flag.Parse()

	port := cfg.Port
	if *portFlag != "8080" {
		port = *portFlag
	}
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	store := db.NewMemoryStore()
	cache := engine.NewDiagnosticsCache()

	preseedDiagnostics(cache)

	if cfg.SeedData {
		log.Println("[Server] Seeding demo data (OZY_SEED_DATA=true)")
		seedMockData(store)
	}

	serverAPI := api.NewServerAPI(store, cache, cfg)
	serverAPI.StartUptimeRecorder()
	mux := http.NewServeMux()
	api.RegisterRoutes(mux, serverAPI)

	serverAddr := ":" + port
	log.Printf("OzyShield Server listening on http://localhost%s", serverAddr)
	log.Printf("   Admin: %s", cfg.AdminEmail)
	log.Printf("   Token: %s", cfg.AuthToken)
	log.Printf("   Registration: %v", cfg.EnableRegister)
	log.Printf("   Seed data: %v", cfg.SeedData)
	if cfg.MistralAPIKey != "" {
		log.Printf("   AI Provider: Mistral (%s)", cfg.MistralModel)
	} else {
		log.Println("   AI Provider: Local heuristics (set MISTRAL_API_KEY for AI analysis)")
	}
	if err := http.ListenAndServe(serverAddr, mux); err != nil {
		log.Fatalf("Fatal: Failed to start web server: %v", err)
	}
}

func preseedDiagnostics(cache *engine.DiagnosticsCache) {
	cache.PreSeed(
		"[CRITICAL] postgresql database query failed: lock timeout after 10000ms. transaction blocked.",
		engine.CachedDiagnosis{
			Cause: "Database query has blocked resources beyond the configured time limit, generating a deadlock.",
			Steps: []string{
				"Identify blocking transactions via pg_stat_activity and pg_locks.",
				"Terminate the blocking query with: SELECT pg_cancel_backend(PID) or SELECT pg_terminate_backend(PID).",
				"Optimize indexes on involved queries to reduce lock retention.",
			},
		},
	)

	cache.PreSeed(
		"[ERROR] nginx worker failed to connect to upstream unix:/var/run/php/php8.2-fpm.sock: Connection refused",
		engine.CachedDiagnosis{
			Cause: "Nginx cannot communicate with the upstream application server because it is down or not listening on the socket.",
			Steps: []string{
				"Check the upstream backend service status (e.g. systemctl status php8.2-fpm).",
				"Verify the unix socket path or IP/port configured in the nginx upstream section.",
				"Inspect backend upstream error logs to determine why it is not responding.",
			},
		},
	)
}

func seedMockData(store db.Store) {
	node1 := db.Node{
		NodeID:   "vm-primary-postgres",
		Name:     "db-primary-postgres",
		OS:       "linux",
		Platform: "amd64",
		CPUCount: 4,
		Services: map[string]string{
			"postgresql": "active",
			"docker":     "active",
			"redis":      "inactive",
		},
	}
	node2 := db.Node{
		NodeID:   "vm-frontend-nginx",
		Name:     "web-frontend-nginx",
		OS:       "linux",
		Platform: "amd64",
		CPUCount: 2,
		Services: map[string]string{
			"nginx":   "active",
			"docker":  "active",
			"apache2": "not_found",
		},
	}
	store.RegisterNode(node1)
	store.RegisterNode(node2)

	diag := engine.AnalyzeLog("[CRITICAL] postgresql database query failed: lock timeout after 10000ms. transaction blocked.", "postgresql", "", "")
	inc := db.Incident{
		ID:          "inc_seed_001",
		NodeID:      "vm-primary-postgres",
		LogLine:     "[CRITICAL] postgresql database query failed: lock timeout after 10000ms. transaction blocked.",
		Service:     "postgresql",
		Diagnosis:   diag.Cause,
		Remediation: diag.Steps,
		Status:      "critical",
	}
	store.AddIncident(inc)
}
