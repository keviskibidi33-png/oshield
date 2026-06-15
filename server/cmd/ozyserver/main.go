package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ozyshield/ozyshield-server/internal/api"
	"github.com/ozyshield/ozyshield-server/internal/db"
	"github.com/ozyshield/ozyshield-server/internal/engine"
)

func main() {
	log.Println("🛡️  Starting OzyShield Central Server...")

	// 1. Configure Port
	portFlag := flag.String("port", "8080", "Port to listen on")
	flag.Parse()

	port := os.Getenv("PORT")
	if port == "" {
		port = *portFlag
	}

	// 2. Initialize Memory Store and Diagnostics Cache
	store := db.NewMemoryStore()
	cache := engine.NewDiagnosticsCache()

	// 3. Preseed Common Error Diagnoses inside Cache
	preseedDiagnostics(cache)

	// 4. Seed initial mock data for Nodes and Incidents to bootstrap Dashboard UI
	seedMockData(store)

	// 5. Initialize API and register routes
	serverAPI := api.NewServerAPI(store, cache)
	mux := http.NewServeMux()
	api.RegisterRoutes(mux, serverAPI)

	// 6. Listen and Serve
	serverAddr := ":" + port
	log.Printf("🚀 OzyShield Server listening on http://localhost%s", serverAddr)
	if err := http.ListenAndServe(serverAddr, mux); err != nil {
		log.Fatalf("Fatal: Failed to start web server: %v", err)
	}
}

func preseedDiagnostics(cache *engine.DiagnosticsCache) {
	// Preseed PostgreSQL Lock Timeout
	cache.PreSeed(
		"[CRITICAL] postgresql database query failed: lock timeout after 10000ms. transaction blocked.",
		engine.CachedDiagnosis{
			Cause: "Un proceso o query de base de datos ha bloqueado recursos por encima del límite de tiempo configurado, generando un interbloqueo (deadlock).",
			Steps: []string{
				"Identificar las transacciones bloqueadoras consultando pg_stat_activity y pg_locks.",
				"Terminar la consulta causante del bloqueo con: SELECT pg_cancel_backend(PID) o SELECT pg_terminate_backend(PID).",
				"Optimizar los índices de las consultas involucradas para reducir la retención de bloqueos.",
			},
		},
	)

	// Preseed Nginx Upstream Timeout
	cache.PreSeed(
		"[ERROR] nginx worker failed to connect to upstream unix:/var/run/php/php8.2-fpm.sock: Connection refused",
		engine.CachedDiagnosis{
			Cause: "Nginx no pudo comunicarse con el servidor de aplicación upstream (Node.js, PHP-FPM, Python, etc.) porque este se encuentra apagado o no escucha en el socket.",
			Steps: []string{
				"Revisar el estado del servicio de backend upstream (ej. systemctl status php8.2-fpm).",
				"Verificar la ruta del socket unix o la dirección IP/puerto configurada en la sección 'upstream' de Nginx.",
				"Inspeccionar los logs de error del backend upstream para determinar por qué no responde.",
			},
		},
	)
}

func seedMockData(store db.Store) {
	// Seed dummy Nodes
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
		LastSeen: time.Now().Add(-5 * time.Minute),
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
		LastSeen: time.Now().Add(-2 * time.Minute),
	}

	store.RegisterNode(node1)
	store.RegisterNode(node2)

	// Seed one initial dummy Incident
	diag := engine.AnalyzeLog("[CRITICAL] postgresql database query failed: lock timeout after 10000ms. transaction blocked.", "postgresql")
	inc := db.Incident{
		ID:          "inc_initial_001",
		NodeID:      "vm-primary-postgres",
		LogLine:     "[CRITICAL] postgresql database query failed: lock timeout after 10000ms. transaction blocked.",
		Service:     "postgresql",
		Diagnosis:   diag.Cause,
		Remediation: diag.Steps,
		Status:      "critical",
		Timestamp:   time.Now().Add(-10 * time.Minute),
	}
	store.AddIncident(inc)
}