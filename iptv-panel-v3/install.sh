#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "  ██╗██████╗ ████████╗██╗   ██╗    ██████╗  █████╗ ███╗   ██╗███████╗██╗"
echo "  ██║██╔══██╗╚══██╔══╝██║   ██║    ██╔══██╗██╔══██╗████╗  ██║██╔════╝██║"
echo "  ██║██████╔╝   ██║   ██║   ██║    ██████╔╝███████║██╔██╗ ██║█████╗  ██║"
echo "  ██║██╔═══╝    ██║   ╚██╗ ██╔╝    ██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║"
echo "  ██║██║        ██║    ╚████╔╝     ██║     ██║  ██║██║ ╚████║███████╗███████╗"
echo "  ╚═╝╚═╝        ╚═╝     ╚═══╝      ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝"
echo -e "${NC}"
echo -e "${BOLD}  IPTV Panel v3 — Automated Installer${NC}"
echo -e "  ─────────────────────────────────────────────────────────────────"
echo ""

# Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR]${NC} Run as root: sudo bash install.sh"
  exit 1
fi

# Detect public IP
echo -e "${BLUE}[1/7]${NC} Detecting server IP..."
SERVER_IP=$(curl -s --max-time 5 -4 ifconfig.me 2>/dev/null \
  || curl -s --max-time 5 -4 icanhazip.com 2>/dev/null \
  || curl -s --max-time 5 -4 api.ipify.org 2>/dev/null \
  || ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 \
  || hostname -I | tr ' ' '\n' | grep -v ':' | head -1)

# If still IPv6, wrap in brackets for valid URL
if echo "$SERVER_IP" | grep -q ':'; then
  SERVER_IP="[$SERVER_IP]"
fi
echo -e "      Server IP: ${GREEN}${SERVER_IP}${NC}"

# Install Docker
echo -e "${BLUE}[2/7]${NC} Installing Docker..."
if ! command -v docker &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  echo -e "      ${GREEN}Docker installed.${NC}"
else
  echo -e "      ${GREEN}Docker already installed.${NC}"
fi

# Install git
echo -e "${BLUE}[3/7]${NC} Installing Git..."
apt-get install -y -qq git
echo -e "      ${GREEN}Git ready.${NC}"

# Clone repo
INSTALL_DIR="/opt/iptv-panel"
echo -e "${BLUE}[4/7]${NC} Cloning repository to ${INSTALL_DIR}..."
if [ -d "$INSTALL_DIR" ]; then
  echo -e "      ${YELLOW}Directory exists, pulling latest...${NC}"
  cd "$INSTALL_DIR"
  git pull origin claude/iptv-management-panel-BKHIa 2>/dev/null || true
else
  git clone -b claude/iptv-management-panel-BKHIa https://github.com/geluionutvechiu-oss/editor.git "$INSTALL_DIR"
fi
cd "$INSTALL_DIR/iptv-panel-v3"
echo -e "      ${GREEN}Repository ready.${NC}"

# Generate secrets
echo -e "${BLUE}[5/7]${NC} Generating secrets..."
JWT_ACCESS=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -hex 16)
echo -e "      ${GREEN}Secrets generated.${NC}"

# Write .env
echo -e "${BLUE}[6/7]${NC} Writing configuration..."
cat > .env <<EOF
# Database
DATABASE_URL=postgresql://iptv:${DB_PASS}@postgres:5432/iptv_panel

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=production
DEFAULT_SERVER_URL=http://${SERVER_IP}:3001

# SMTP (optional — configure in Settings panel after login)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@iptv.local

# Postgres (used by docker-compose)
POSTGRES_DB=iptv_panel
POSTGRES_USER=iptv
POSTGRES_PASSWORD=${DB_PASS}
EOF
echo -e "      ${GREEN}.env written.${NC}"

# Start containers
echo -e "${BLUE}[7/7]${NC} Starting IPTV Panel (this may take 2-3 minutes)..."
docker compose pull 2>&1 | grep -E "Pulling|pulled|up to date" || true
docker compose --profile production up -d --build

# Wait for backend to be ready
echo ""
echo -e "${YELLOW}Waiting for services to start...${NC}"
MAX_WAIT=120
WAITED=0
until docker compose exec -T backend wget -qO- http://localhost:3001/api/health &>/dev/null; do
  sleep 3
  WAITED=$((WAITED+3))
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}Services still starting (normal for first run — DB migrations running)${NC}"
    break
  fi
  echo -n "."
done
echo ""

# Print summary
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           IPTV Panel v3 — Installation Complete!             ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Panel URL:${NC}      ${CYAN}http://${SERVER_IP}${NC}"
echo -e "  ${BOLD}API URL:${NC}        ${CYAN}http://${SERVER_IP}:3001${NC}"
echo ""
echo -e "  ${BOLD}Login Credentials:${NC}"
echo -e "  ┌─────────────┬──────────────────────────────────┬──────────────┐"
echo -e "  │ ${BOLD}Role${NC}        │ ${BOLD}Email${NC}                            │ ${BOLD}Password${NC}     │"
echo -e "  ├─────────────┼──────────────────────────────────┼──────────────┤"
echo -e "  │ Admin       │ admin@iptv.local                 │ admin123     │"
echo -e "  │ Reseller 1  │ ionescu.mihai@reseller.local     │ reseller123  │"
echo -e "  │ Reseller 2  │ popescu.elena@reseller.local     │ reseller123  │"
echo -e "  └─────────────┴──────────────────────────────────┴──────────────┘"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "  • View logs:    ${CYAN}cd ${INSTALL_DIR}/iptv-panel-v3 && docker compose logs -f${NC}"
echo -e "  • Stop panel:   ${CYAN}cd ${INSTALL_DIR}/iptv-panel-v3 && docker compose down${NC}"
echo -e "  • Update panel: ${CYAN}cd ${INSTALL_DIR}/iptv-panel-v3 && git pull && docker compose up -d --build${NC}"
echo ""
echo -e "  ${BOLD}Config file:${NC}    ${INSTALL_DIR}/iptv-panel-v3/.env"
echo ""
echo -e "${YELLOW}  IMPORTANT: Change default passwords after first login!${NC}"
echo ""
