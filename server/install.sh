#!/usr/bin/env bash

# ==============================================================================
# OzyShield Agent - Universal Linux Installer
# ==============================================================================
# This script installs the OzyShield monitoring agent on a client VM, 
# configures it, and registers it as a systemd service.

set -e

# Configuration defaults
OZY_CLIENT_TOKEN=""
OZY_SERVER_URL="http://localhost:8080"
OZY_LOG_PATHS="/var/log/syslog,/var/log/nginx/error.log"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/ozyshield"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛡️  Starting OzyShield Agent Installer...${NC}"

# 1. Ensure running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run as root (use sudo).${NC}"
  exit 1
fi

# 2. Check for Token
if [ -z "$OZY_CLIENT_TOKEN" ]; then
  echo -e "${YELLOW}[Warning] OZY_CLIENT_TOKEN is not hardcoded. Checking environment...${NC}"
  if [ -z "$OZY_CLIENT_TOKEN" ]; then
    echo -e "${RED}Error: OZY_CLIENT_TOKEN must be specified.${NC}"
    echo -e "Usage: curl -sSL http://<server>/v1/install.sh?token=<token> | sudo bash"
    exit 1
  fi
fi

# 3. Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)
    BINARY_ARCH="amd64"
    ;;
  aarch64|arm64)
    BINARY_ARCH="arm64"
    ;;
  *)
    echo -e "${RED}Error: Unsupported architecture: $ARCH. OzyShield agent requires amd64 or arm64.${NC}"
    exit 1
esac

echo -e "   ├─ Detected system architecture: ${GREEN}$ARCH${NC} ($BINARY_ARCH)"

# 4. Download agent binary from Server
DOWNLOAD_URL="${OZY_SERVER_URL}/v1/bin/ozyagent-linux-${BINARY_ARCH}"
echo -e "   ├─ Fetching precompiled binary from server..."

# Create installation directory if not exists
mkdir -p "$INSTALL_DIR"

# Download binary (in production, fall back to Github/CDN if needed, but pulling from server is standard)
# For local validation, if server binary doesn't exist yet, we will output warning
if ! curl -sSfL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/ozyagent"; then
  echo -e "${YELLOW}[Warning] Could not pull binary from ${DOWNLOAD_URL}.${NC}"
  echo -e "${YELLOW}           Using placeholder agent binary or local compilation...${NC}"
  
  # Check if a local binary is already present to copy
  if [ -f "./agent/ozyagent" ]; then
    cp "./agent/ozyagent" "${INSTALL_DIR}/ozyagent"
  else
    echo -e "${RED}Error: No precompiled ozyagent binary found.${NC}"
    exit 1
  fi
fi

chmod +x "${INSTALL_DIR}/ozyagent"
echo -e "   ├─ Binary placed in ${GREEN}${INSTALL_DIR}/ozyagent${NC}"

# 5. Create Configuration Folder and File
mkdir -p "$CONFIG_DIR"
CONFIG_FILE="${CONFIG_DIR}/ozyagent.conf"

cat << EOF > "$CONFIG_FILE"
# OzyShield Agent Configuration
OZY_CLIENT_TOKEN="${OZY_CLIENT_TOKEN}"
OZY_SERVER_URL="${OZY_SERVER_URL}"
OZY_LOG_PATHS="${OZY_LOG_PATHS}"
OZY_NODE_ID="$(hostname)"
EOF

chmod 600 "$CONFIG_FILE"
echo -e "   ├─ Configuration written to ${GREEN}${CONFIG_FILE}${NC}"

# 6. Create Systemd Service File
SERVICE_FILE="/etc/systemd/system/ozyagent.service"

cat << EOF > "$SERVICE_FILE"
[Unit]
Description=OzyShield Security and Infrastructure Monitoring Agent
After=network.target

[Service]
Type=simple
EnvironmentFile=${CONFIG_FILE}
ExecStart=${INSTALL_DIR}/ozyagent
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

echo -e "   ├─ Systemd service registered at ${GREEN}${SERVICE_FILE}${NC}"

# 7. Start and Enable Service
echo -e "   ├─ Reloading systemd and starting ozyagent daemon..."
systemctl daemon-reload
systemctl enable ozyagent
systemctl restart ozyagent

echo -e "${GREEN}🚀 OzyShield Agent successfully installed and started!${NC}"
echo -e "   └─ Monitor logs using: ${BLUE}journalctl -u ozyagent -f${NC}"