package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/ozyshield/ozyshield-agent/internal/client"
	"github.com/ozyshield/ozyshield-agent/internal/config"
	"github.com/ozyshield/ozyshield-agent/internal/discovery"
	"github.com/ozyshield/ozyshield-agent/internal/filter"
	"github.com/ozyshield/ozyshield-agent/internal/monitor"
)

func main() {
	log.Println("🛡️  Starting OzyShield Agent...")

	// 1. Load configuration
	cfg := config.LoadConfig()

	if cfg.ClientToken == "" {
		log.Println("[Warning] OZY_CLIENT_TOKEN is not set. The agent will run in DEMO/Local mode.")
		cfg.ClientToken = "demo-local-token"
	}

	// Create root cancelable context for all agent goroutines
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 2. Perform system architecture discovery
	log.Printf("[Info] Performing system architecture scan for Node ID: %s", cfg.NodeID)
	sysMap := discovery.ScanSystem(ctx)

	// Print discovered services
	for svc, status := range sysMap.Services {
		log.Printf("   ├─ Service [%s]: %s", svc, status)
	}

	// 3. Register Node discovery stats with Central API
	log.Printf("[Info] Registering node discovery metadata with Central Server (%s)...", cfg.ServerURL)
	err := client.ReportDiscovery(ctx, cfg.ServerURL, cfg.ClientToken, cfg.NodeID, sysMap)
	if err != nil {
		log.Printf("[Warning] Failed to report system discovery map: %v. Running in localized mode.", err)
	} else {
		log.Println("   └─ System map successfully uploaded.")
	}

	// 4. Initialize Rate Limiter & Deduplication
	// 5 tokens capacity, refills 0.2 tokens/sec (1 token every 5s), 15s sliding deduplication window
	limiter := filter.NewRateLimiter(5.0, 0.2, 15*time.Second)

	// Channel for aggregate log tailing events
	linesChan := make(chan monitor.LogLine, 100)

	// Start tailing each configured path in a separate goroutine
	for _, path := range cfg.LogPaths {
		log.Printf("[Info] Tailing log path: %s", path)
		// Ensure file exists or write a header to it if Windows fallback
		if _, err := os.Stat(path); os.IsNotExist(err) {
			// Create dummy file for demo compatibility if it doesn't exist
			f, createErr := os.Create(path)
			if createErr == nil {
				f.WriteString("[INFO] Log file created by OzyShield Agent\n")
				f.Close()
			}
		}
		go monitor.TailFile(ctx, path, linesChan)
	}

	log.Println("🚀 OzyShield Agent is active. Watching logs for errors...")

	// Catch termination signals for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 5. Main Event Loop
	for {
		select {
		case <-sigChan:
			log.Println("🛑 Shutting down OzyShield Agent gracefully...")
			cancel()
			return

		case line := <-linesChan:
			// Look for error keywords in log content
			upperLine := strings.ToUpper(line.Content)
			isError := strings.Contains(upperLine, "ERROR") ||
				strings.Contains(upperLine, "CRITICAL") ||
				strings.Contains(upperLine, "FATAL") ||
				strings.Contains(upperLine, "FAIL") ||
				strings.Contains(upperLine, "PANIC") ||
				strings.Contains(upperLine, "WARNING")

			if isError {
				// 1. Check Rate Limiter & Deduplication first (saves CPU and bandwidth)
				if !limiter.Allow(line.Content) {
					// Log is either a duplicate within 15s or bucket is rate-limited
					continue
				}

				// 2. Perform zero-knowledge sanitization on the raw log
				sanitized := filter.Sanitize(line.Content)

				// 3. Detect suspicious patterns
				suspiciousMatches := filter.DetectSuspiciousPatterns(line.Content)

				// Determine matching service source based on log path
				svc := "system"
				for _, s := range []string{"nginx", "postgresql", "docker", "mysql", "redis", "mongodb"} {
					if strings.Contains(strings.ToLower(line.Path), s) {
						svc = s
						break
					}
				}

				log.Printf("[Ingest] Incident detected: %s (Redacted & reporting...)", line.Content[:min(len(line.Content), 50)])

				// 4. Dispatch telemetry report via HTTPS
				payload := client.TelemetryPayload{
					ClientToken:        cfg.ClientToken,
					NodeID:             cfg.NodeID,
					LogLine:            sanitized,
					Service:            svc,
					Timestamp:          line.Timestamp,
					SuspiciousPatterns: suspiciousMatches,
				}

				go func(p client.TelemetryPayload) {
					postErr := client.Report(ctx, cfg.ServerURL, p)
					if postErr != nil {
						log.Printf("[Error] Failed to report telemetry: %v", postErr)
					}
				}(payload)

				// 5. Report suspicious patterns as separate alerts
				if len(suspiciousMatches) > 0 {
					for _, match := range suspiciousMatches {
						log.Printf("[ALERT] Suspicious pattern detected: %s (%s)", match.Name, match.Category)
						alertPayload := client.AlertPayload{
							ClientToken: cfg.ClientToken,
							NodeID:      cfg.NodeID,
							Pattern:     match.Name,
							Category:    match.Category,
							Severity:    match.Severity,
							LogLine:     sanitized,
							Service:     svc,
							Timestamp:   line.Timestamp,
						}
						go func(a client.AlertPayload) {
							if alertErr := client.ReportAlert(ctx, cfg.ServerURL, a); alertErr != nil {
								log.Printf("[Error] Failed to report alert: %v", alertErr)
							}
						}(alertPayload)
					}
				}
			}
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}