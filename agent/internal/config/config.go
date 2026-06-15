package config

import (
	"flag"
	"os"
	"strings"
)

// Config holds the configuration settings for the agent.
type Config struct {
	ClientToken string   // Token identifying the client/company
	NodeID      string   // Unique ID of the host machine
	LogPaths    []string // Files to monitor
	ServerURL   string   // Central OzyShield backend URL
}

// LoadConfig merges configuration from environment variables and command line flags.
func LoadConfig() *Config {
	cfg := &Config{}

	// Define command-line flags
	tokenFlag := flag.String("token", "", "OzyShield Client Token")
	nodeFlag := flag.String("node", "", "Unique Node ID")
	pathsFlag := flag.String("paths", "", "Comma-separated list of log paths to monitor")
	serverFlag := flag.String("server", "http://localhost:8080", "Central OzyShield server URL")
	flag.Parse()

	// 1. Client Token priority: Env > Flag
	cfg.ClientToken = os.Getenv("OZY_CLIENT_TOKEN")
	if cfg.ClientToken == "" {
		cfg.ClientToken = *tokenFlag
	}

	// 2. Node ID priority: Env > Flag > Hostname
	cfg.NodeID = os.Getenv("OZY_NODE_ID")
	if cfg.NodeID == "" {
		cfg.NodeID = *nodeFlag
	}
	if cfg.NodeID == "" {
		hostname, err := os.Hostname()
		if err == nil {
			cfg.NodeID = hostname
		} else {
			cfg.NodeID = "unknown-node"
		}
	}

	// 3. Log paths priority: Env > Flag > Default paths
	pathsStr := os.Getenv("OZY_LOG_PATHS")
	if pathsStr == "" {
		pathsStr = *pathsFlag
	}

	if pathsStr != "" {
		rawPaths := strings.Split(pathsStr, ",")
		for _, p := range rawPaths {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				cfg.LogPaths = append(cfg.LogPaths, trimmed)
			}
		}
	}

	// If no paths specified, apply default fallback based on OS
	if len(cfg.LogPaths) == 0 {
		if os.PathSeparator == '/' {
			// Linux/macOS defaults
			cfg.LogPaths = []string{"/var/log/syslog", "/var/log/nginx/error.log"}
		} else {
			// Windows defaults
			cfg.LogPaths = []string{"C:\\Windows\\Temp\\ozy.log"}
		}
	}

	// 4. Server URL priority: Env > Flag
	cfg.ServerURL = os.Getenv("OZY_SERVER_URL")
	if cfg.ServerURL == "" {
		cfg.ServerURL = *serverFlag
	}

	return cfg
}