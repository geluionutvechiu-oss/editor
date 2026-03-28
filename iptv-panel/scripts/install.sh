#!/bin/bash
# =============================================================
# IPTV Panel - One-Click Install Script for Ubuntu 20.04/22.04
# Usage: curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/iptv-panel/scripts/install.sh | bash
# =============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
step() { echo -e "\n${BOLD}${CYAN}==> $1${NC}"; }

echo ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║        IPTV Management Panel             ║${NC}"
echo -e "${BOLD}${BLUE}║     Production Install Script v1.0       ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root: sudo bash install.sh"
fi

# Check OS
if ! command -v lsb_release &>/dev/null; then
    error "lsb_release not found. Unsupported OS."
fi

OS_ID=$(lsb_release -si)
OS_VERSION=$(lsb_release -sr)

if [[ "$OS_ID" != "Ubuntu" && "$OS_ID" != "Debian" ]]; then
    warn "This script is tested on Ubuntu/Debian. Proceeding anyway..."
fi

# Check available RAM
TOTAL_RAM=$(free -m | awk '/Mem:/ {print $2}')
if [ "$TOTAL_RAM" -lt 1024 ]; then
    warn "Less than 1GB RAM detected (${TOTAL_RAM}MB). Recommended: 2GB+"
fi

# =============================================================
# STEP 1: Get Configuration
# =============================================================
step "Configuration"

INSTALL_DIR="/opt/iptv-panel"
echo ""

# Panel domain
read -p "Enter your server's domain or IP address [$(curl -s ifconfig.me 2>/dev/null || echo 'your-ip')]: " PANEL_DOMAIN
PANEL_DOMAIN=${PANEL_DOMAIN:-$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')}

# Admin credentials
read -p "Admin username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

while true; do
    read -sp "Admin password (min 8 chars): " ADMIN_PASS
    echo ""
    if [ ${#ADMIN_PASS} -ge 8 ]; then break
    else warn "Password must be at least 8 characters"; fi
done

# TMDB API Key
read -p "TMDB API Key (optional, for movie metadata) [skip]: " TMDB_KEY
TMDB_KEY=${TMDB_KEY:-}

# Generate random secrets
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
REDIS_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

log "Configuration collected"

# =============================================================
# STEP 2: Install Dependencies
# =============================================================
step "Installing system dependencies"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    curl wget git openssl ca-certificates \
    gnupg lsb-release apt-transport-https \
    software-properties-common net-tools

log "System dependencies installed"

# =============================================================
# STEP 3: Install Docker
# =============================================================
step "Installing Docker"

if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    log "Docker installed: $(docker --version)"
fi

if ! command -v docker compose &>/dev/null; then
    DOCKER_COMPOSE_VERSION="2.24.5"
    curl -SL "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

log "Docker Compose: $(docker compose version 2>/dev/null || docker-compose --version)"

# =============================================================
# STEP 4: Clone / Copy Project
# =============================================================
step "Setting up project files"

if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR"
fi

# If running from within the repo, copy files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$REPO_ROOT/docker/docker-compose.yml" ]; then
    info "Copying from local repo..."
    cp -r "$REPO_ROOT"/* "$INSTALL_DIR"/
else
    info "Cloning from GitHub..."
    # Update this URL to your actual repo
    git clone --depth=1 https://github.com/geluionutvechiu-oss/editor.git /tmp/iptv-repo
    cp -r /tmp/iptv-repo/iptv-panel/* "$INSTALL_DIR"/
    rm -rf /tmp/iptv-repo
fi

log "Project files ready at $INSTALL_DIR"

# =============================================================
# STEP 5: Generate .env file
# =============================================================
step "Creating environment configuration"

cat > "$INSTALL_DIR/docker/.env" << EOF
# Generated by install.sh on $(date)
# ============================================================

# Panel Configuration
PANEL_DOMAIN=${PANEL_DOMAIN}
PANEL_URL=http://${PANEL_DOMAIN}

# Database
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
DB_NAME=iptv_panel
DB_USER=iptv_user
DB_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# Security
JWT_SECRET=${JWT_SECRET}

# API Keys
TMDB_API_KEY=${TMDB_KEY}
EOF

chmod 600 "$INSTALL_DIR/docker/.env"
log ".env file created"

# =============================================================
# STEP 6: Build and Start Services
# =============================================================
step "Building Docker images (this may take 5-10 minutes)"

cd "$INSTALL_DIR/docker"
docker compose --env-file .env build --no-cache 2>&1 | tail -20
log "Images built"

step "Starting services"
docker compose --env-file .env up -d

log "Waiting for MySQL to initialize (60 seconds)..."
sleep 60

# =============================================================
# STEP 7: Create Admin User
# =============================================================
step "Creating admin user"

# Hash password using Python
ADMIN_HASH=$(docker compose exec -T mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" iptv_panel -e \
    "SELECT password FROM users WHERE username='admin';" 2>/dev/null | tail -1 || echo "")

if [ -z "$ADMIN_HASH" ]; then
    # Generate bcrypt hash
    HASH=$(docker compose exec -T python-epg python3 -c \
        "import bcrypt; print(bcrypt.hashpw('${ADMIN_PASS}'.encode(), bcrypt.gensalt(12)).decode())")

    docker compose exec -T mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" iptv_panel << SQL
INSERT INTO users (username, password, role, is_active, exp_date, max_connections)
VALUES ('${ADMIN_USER}', '${HASH}', 'admin', 1, NULL, 10)
ON DUPLICATE KEY UPDATE password = '${HASH}';
SQL
    log "Admin user '${ADMIN_USER}' created"
else
    warn "Admin user already exists"
fi

# =============================================================
# STEP 8: Configure Firewall
# =============================================================
step "Configuring firewall"

if command -v ufw &>/dev/null; then
    ufw --force enable
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    log "UFW firewall configured"
fi

# =============================================================
# DONE
# =============================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         Installation Complete! 🎉                ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Panel URL:${NC}       http://${PANEL_DOMAIN}/admin"
echo -e "  ${BOLD}Player URL:${NC}      http://${PANEL_DOMAIN}/player"
echo -e "  ${BOLD}Admin Username:${NC}  ${ADMIN_USER}"
echo -e "  ${BOLD}Admin Password:${NC}  (as entered)"
echo ""
echo -e "  ${BOLD}Xtream API:${NC}      http://${PANEL_DOMAIN}/player_api.php"
echo -e "  ${BOLD}M3U Playlist:${NC}    http://${PANEL_DOMAIN}/get.php?username=USER&password=PASS&type=m3u_plus"
echo -e "  ${BOLD}XMLTV EPG:${NC}       http://${PANEL_DOMAIN}/xmltv.php?username=USER&password=PASS"
echo ""
echo -e "  ${BOLD}Config file:${NC}     ${INSTALL_DIR}/docker/.env"
echo -e "  ${BOLD}Logs:${NC}            docker compose -f ${INSTALL_DIR}/docker/docker-compose.yml logs -f"
echo ""
echo -e "  ${YELLOW}DB Password:${NC}     ${DB_PASSWORD}"
echo -e "  ${YELLOW}Redis Password:${NC}  ${REDIS_PASSWORD}"
echo -e "  ${YELLOW}Save these credentials securely!${NC}"
echo ""

# Save credentials to file
cat > /root/iptv-credentials.txt << CREDS
IPTV Panel Credentials - $(date)
================================
Panel URL: http://${PANEL_DOMAIN}/admin
Admin User: ${ADMIN_USER}

Database Password: ${DB_PASSWORD}
Redis Password: ${REDIS_PASSWORD}
JWT Secret: ${JWT_SECRET}
MySQL Root: ${MYSQL_ROOT_PASSWORD}
CREDS
chmod 600 /root/iptv-credentials.txt
log "Credentials saved to /root/iptv-credentials.txt"
