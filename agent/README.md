# 🛡️ OzyShield Monitoring Agent

The **OzyShield Agent** is an ultra-lightweight, high-performance daemon written in Go. It runs locally on client servers (VMs) to perform real-time error log tailing with **Zero-Knowledge Sanitization** before transmitting telemetry data back to the central OzyShield API.

---

## 🚀 Key Features

* **Zero-Knowledge Sanitization**: Leverages local Regex engine and the Luhn check algorithm to redact credit cards, database connection URIs, access tokens, email addresses, and passwords before they leave the machine.
* **Smart Rate Limiting**: Uses a token bucket rate limiter to prevent telemetry storms from consuming downstream AI API budgets.
* **Error Deduplication**: Automatically aggregates and silences repeating duplicate alerts within a 15-second sliding window.
* **Auto-Discovery**: Scans system properties and active services (Nginx, Postgres, Redis, Docker, etc.) on boot.
* **Rotatable Log Tailing**: Monitors files concurrently using Goroutines, handling rename-and-recreate log rotations and file truncations safely via OS inode checks.

---

## 🛠️ Configuration

The agent loads configurations through environment variables or command-line flags (environment variables take priority):

| Flag | Environment Variable | Default Value | Description |
|---|---|---|---|
| `-token` | `OZY_CLIENT_TOKEN` | *None (Required)* | The token identifying your account. |
| `-node` | `OZY_NODE_ID` | `hostname` | Unique ID of the host server. |
| `-paths` | `OZY_LOG_PATHS` | `/var/log/syslog` | Comma-separated paths of log files to tail. |
| `-server` | `OZY_SERVER_URL` | `http://localhost:8080` | URL of the central OzyShield API server. |

---

## 🏗️ Building from Source

To compile the agent binary from source:

1. **Install Go**: Ensure Go 1.22+ is installed on your system.
2. **Build**:
   ```bash
   cd agent
   go build -o ozyagent cmd/ozyagent/main.go
   ```
3. **Run tests**:
   ```bash
   go test -v ./internal/...
   ```

---

## 📦 Production Deployment

For production VM deployments, use the universal installer script served by your OzyShield API server:

```bash
curl -sSL https://<your-server>/v1/install.sh?token=YOUR_CLIENT_TOKEN | sudo bash
```

This script will automatically:
1. Detect your CPU architecture (amd64 / arm64).
2. Fetch the corresponding precompiled binary.
3. Configure the settings at `/etc/ozyshield/ozyagent.conf`.
4. Register and start a systemd service (`ozyagent.service`) to ensure persistence.