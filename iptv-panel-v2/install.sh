#!/bin/bash
set -e

# ============================================================
# IPTV Panel - Complete Install Script
# Tested on Ubuntu 22.04 / 24.04 fresh install
# ============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║         IPTV Management Panel Installer          ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Install Docker ─────────────────────────────────────
info "Installing Docker..."
if ! command -v docker &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release git
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    ok "Docker installed"
else
    ok "Docker already installed"
fi

# ── 2. Clone repo ─────────────────────────────────────────
INSTALL_DIR=/opt/iptv
BRANCH="claude/iptv-management-panel-BKHIa"
REPO="https://github.com/geluionutvechiu-oss/editor.git"

info "Cloning repository..."
rm -rf "$INSTALL_DIR"
git clone --depth=1 -b "$BRANCH" "$REPO" "$INSTALL_DIR"
ok "Repository cloned to $INSTALL_DIR"

# ── 3. Setup Panel v1 (Node.js + React) ───────────────────
info "Setting up IPTV Panel v1 (port 80)..."
cd "$INSTALL_DIR/iptv-panel/docker"

cat > .env <<EOF
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
MYSQL_DATABASE=iptv_panel
MYSQL_USER=iptv_user
MYSQL_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@iptv.local
ADMIN_PASS=admin123
NODE_ENV=production
EOF

ok "Panel v1 .env created"

# ── 4. Setup Panel v2 (Laravel + Next.js) ────────────────
info "Setting up IPTV Panel v2 (port 8081)..."
V2_DIR="$INSTALL_DIR/iptv-panel-v2"
cd "$V2_DIR"

APP_KEY="base64:$(openssl rand -base64 32)"
JWT_SECRET=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -hex 16)

# Overwrite docker-compose with generated secrets
cat > docker-compose.yml <<EOF
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: iptv_panel
      POSTGRES_USER: iptv_user
      POSTGRES_PASSWORD: ${DB_PASS}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U iptv_user -d iptv_panel"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    environment:
      APP_ENV: production
      APP_DEBUG: "false"
      APP_KEY: "${APP_KEY}"
      APP_URL: http://localhost:8081
      DB_CONNECTION: pgsql
      DB_HOST: postgres
      DB_PORT: 5432
      DB_DATABASE: iptv_panel
      DB_USERNAME: iptv_user
      DB_PASSWORD: ${DB_PASS}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: "${JWT_SECRET}"
      BROADCAST_DRIVER: log
      CACHE_DRIVER: redis
      QUEUE_CONNECTION: redis
      SESSION_DRIVER: redis
    ports:
      - "8000:8000"
    restart: unless-stopped

  horizon:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: php artisan horizon
    depends_on:
      - backend
    environment:
      APP_ENV: production
      APP_KEY: "${APP_KEY}"
      DB_CONNECTION: pgsql
      DB_HOST: postgres
      DB_PORT: 5432
      DB_DATABASE: iptv_panel
      DB_USERNAME: iptv_user
      DB_PASSWORD: ${DB_PASS}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      QUEUE_CONNECTION: redis
      JWT_SECRET: "${JWT_SECRET}"
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_URL: /api
      NEXT_PUBLIC_APP_NAME: IPTV Panel
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    depends_on:
      - frontend
      - backend
    ports:
      - "8081:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
EOF

ok "Panel v2 docker-compose.yml generated with random secrets"

# ── 5. Build & start Panel v2 ─────────────────────────────
info "Building Panel v2 (this takes 3-5 min)..."
docker compose build --no-cache 2>&1 | tail -5
docker compose up -d
ok "Panel v2 started"

# Wait for backend to be ready
info "Waiting for backend to initialize (migrations + seeders)..."
sleep 15
for i in $(seq 1 30); do
    if docker compose logs backend 2>/dev/null | grep -q "Server running on"; then
        ok "Backend ready"
        break
    fi
    sleep 3
done

# ── 6. Build & start Panel v1 ─────────────────────────────
info "Building Panel v1 (this takes 2-3 min)..."
cd "$INSTALL_DIR/iptv-panel/docker"
docker compose build --no-cache 2>&1 | tail -5
docker compose up -d

# Run panel v1 install script if available
if [ -f "$INSTALL_DIR/iptv-panel/scripts/install.sh" ]; then
    bash "$INSTALL_DIR/iptv-panel/scripts/install.sh" --non-interactive 2>/dev/null || true
fi

ok "Panel v1 started"

# ── 7. Done ───────────────────────────────────────────────
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            Installation Complete!                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Panel v1 (Node.js + React):${NC}"
echo -e "  URL:      http://${SERVER_IP}/admin"
echo -e "  Login:    admin / admin123"
echo ""
echo -e "  ${CYAN}Panel v2 (Laravel + Next.js):${NC}"
echo -e "  URL:      http://${SERVER_IP}:8081"
echo -e "  Login:    admin@iptv.local / admin123"
echo ""
echo -e "  ${YELLOW}Logs:${NC}"
echo -e "  Panel v1: docker compose -f $INSTALL_DIR/iptv-panel/docker/docker-compose.yml logs -f"
echo -e "  Panel v2: docker compose -f $V2_DIR/docker-compose.yml logs -f backend"
echo ""
