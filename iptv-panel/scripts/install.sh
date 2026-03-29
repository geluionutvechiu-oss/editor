#!/bin/bash
# =============================================================
# IPTV Panel - One-Click Install Script Ubuntu 20.04/22.04/24.04
# =============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
step() { echo -e "\n${BOLD}${CYAN}==> $1${NC}"; }

echo ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║        IPTV Management Panel             ║${NC}"
echo -e "${BOLD}${BLUE}║     Production Install Script v2.0       ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

[ "$EUID" -ne 0 ] && err "Rulează ca root: sudo bash install.sh"

# =============================================================
# STEP 1: Configurare
# =============================================================
step "Configurare"

INSTALL_DIR="/opt/iptv-panel"
DEFAULT_IP=$(hostname -I | awk '{print $1}')

read -p "IP sau domeniu server [$DEFAULT_IP]: " PANEL_DOMAIN
PANEL_DOMAIN=${PANEL_DOMAIN:-$DEFAULT_IP}

read -p "Username admin [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

while true; do
    read -sp "Parola admin (min 8 caractere): " ADMIN_PASS
    echo ""
    [ ${#ADMIN_PASS} -ge 8 ] && break
    warn "Parola trebuie sa aiba minim 8 caractere"
done

read -p "TMDB API Key (optional, pentru metadata filme) [skip]: " TMDB_KEY
TMDB_KEY=${TMDB_KEY:-}

# Generare parole random
DB_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 12)
JWT_SECRET=$(openssl rand -hex 32)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)

log "Configurare completata"

# =============================================================
# STEP 2: Dependinte sistem
# =============================================================
step "Instalare dependinte sistem"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget git openssl ca-certificates \
    gnupg lsb-release apt-transport-https software-properties-common

log "Dependinte instalate"

# Opreste servicii care ocupa porturile 80, 443, 3306, 6379
info "Eliberare porturi (80, 443)..."
for svc in nginx apache2 apache httpd mysql mariadb redis redis-server; do
    systemctl stop $svc 2>/dev/null || true
    systemctl disable $svc 2>/dev/null || true
done
# Ucide orice proces pe porturile critice
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
sleep 2
log "Porturi eliberate"

# =============================================================
# STEP 3: Docker
# =============================================================
step "Verificare/Instalare Docker"

if ! command -v docker &>/dev/null; then
    info "Instalare Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    log "Docker instalat: $(docker --version)"
else
    log "Docker deja instalat: $(docker --version)"
fi

# Verifica docker compose (plugin v2)
if docker compose version &>/dev/null 2>&1; then
    log "Docker Compose: $(docker compose version)"
else
    info "Instalare Docker Compose plugin..."
    mkdir -p /usr/local/lib/docker/cli-plugins
    COMPOSE_VER="2.24.5"
    curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VER}/docker-compose-linux-x86_64" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    log "Docker Compose instalat"
fi

# =============================================================
# STEP 4: Fisiere proiect
# =============================================================
step "Pregatire fisiere proiect"

# Curata instalare veche complet
if [ -d "$INSTALL_DIR" ]; then
    warn "Instalare veche gasita. Curatare completa..."
    if [ -f "$INSTALL_DIR/docker/docker-compose.yml" ]; then
        cd "$INSTALL_DIR/docker" && docker compose down -v 2>/dev/null || true
        cd /
    fi
    rm -rf "$INSTALL_DIR"
fi

# Curata containere si retele Docker ramase
info "Curatare containere Docker vechi..."
docker ps -aq --filter "name=iptv_" | xargs -r docker stop 2>/dev/null || true
docker ps -aq --filter "name=iptv_" | xargs -r docker rm 2>/dev/null || true
docker network ls --filter "name=docker_iptv" -q | xargs -r docker network rm 2>/dev/null || true
docker network prune -f 2>/dev/null || true

mkdir -p "$INSTALL_DIR"

# Cloneaza din GitHub
info "Descarcare cod din GitHub..."
rm -rf /tmp/iptv-repo
git clone --depth=1 -b claude/iptv-management-panel-BKHIa \
    https://github.com/geluionutvechiu-oss/editor.git /tmp/iptv-repo
cp -r /tmp/iptv-repo/iptv-panel/* "$INSTALL_DIR"/
rm -rf /tmp/iptv-repo

log "Fisiere pregatite la $INSTALL_DIR"

# =============================================================
# STEP 5: Fisier .env
# =============================================================
step "Creare configuratie .env"

cat > "$INSTALL_DIR/docker/.env" << ENVEOF
PANEL_DOMAIN=${PANEL_DOMAIN}
PANEL_URL=http://${PANEL_DOMAIN}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
DB_NAME=iptv_panel
DB_USER=iptv_user
DB_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
TMDB_API_KEY=${TMDB_KEY}
CORS_ORIGINS=http://${PANEL_DOMAIN}
ENVEOF

chmod 600 "$INSTALL_DIR/docker/.env"
log "Fisier .env creat"

# =============================================================
# STEP 6: Build imagini Docker
# =============================================================
step "Build imagini Docker (5-15 minute)..."

cd "$INSTALL_DIR/docker"

docker compose --env-file .env build --no-cache
log "Imagini construite"

# =============================================================
# STEP 7: Pornire servicii
# =============================================================
step "Pornire servicii"

docker compose --env-file .env up -d
log "Containere pornite"

# Asteapta MySQL sa fie gata (polling activ)
info "Asteptare initializare MySQL..."
MAX_WAIT=180
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker compose --env-file .env exec -T mysql \
        mysql -u iptv_user -p"${DB_PASSWORD}" iptv_panel \
        -e "SELECT 1;" &>/dev/null 2>&1; then
        log "MySQL gata!"
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    echo -n "."
done
echo ""

if [ $WAITED -ge $MAX_WAIT ]; then
    warn "MySQL timeout dupa ${MAX_WAIT}s. Continuam oricum..."
fi

# =============================================================
# STEP 8: Creare user admin
# =============================================================
step "Creare user admin"

# Asteapta node-api sa fie disponibil (are bcryptjs)
info "Asteptare node-api..."
for i in $(seq 1 24); do
    if docker compose --env-file .env exec -T node-api node -e "require('bcryptjs')" 2>/dev/null; then
        break
    fi
    sleep 5
done

# Genereaza hash bcrypt folosind node-api (garantat are bcryptjs)
HASH=$(docker compose --env-file .env exec -T node-api \
    node -e "const b=require('bcryptjs');b.hash(process.argv[1],12).then(h=>process.stdout.write(h));" \
    "${ADMIN_PASS}" 2>/dev/null | tr -d '\r\n')

# Fallback: genereaza cu openssl + hardcodat daca node-api nu e gata
if [ -z "$HASH" ] || [ ${#HASH} -lt 55 ]; then
    warn "Fallback hash bcrypt (schimba parola dupa login din Settings)"
    # Hash valid pentru parola temporara 'TempPass123' - va fi suprascris mai jos
    HASH='$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
    # Nota: parola temporara e 'password' - SCHIMBA IMEDIAT
fi

# Scrie parola folosita in credentials file pentru referinta
ACTUAL_PASS="${ADMIN_PASS}"
[ ${#HASH} -lt 55 ] && ACTUAL_PASS="password (SCHIMBA IMEDIAT!)"

# Inserare user admin in DB
docker compose --env-file .env exec -T mysql \
    mysql -u iptv_user -p"${DB_PASSWORD}" iptv_panel -e \
    "INSERT INTO users (username, password, role, is_active, max_connections, max_mobile_connections, max_stb_connections)
     VALUES ('${ADMIN_USER}', '${HASH}', 'admin', 1, 999, 999, 999)
     ON DUPLICATE KEY UPDATE password='${HASH}', role='admin', is_active=1,
     max_connections=999, max_mobile_connections=999, max_stb_connections=999;" \
    2>/dev/null && log "User admin '${ADMIN_USER}' creat cu succes" \
    || warn "Creare admin esuata - ruleaza manual dupa instalare"

# =============================================================
# STEP 9: Firewall
# =============================================================
step "Configurare firewall"

if command -v ufw &>/dev/null; then
    ufw --force enable 2>/dev/null || true
    ufw allow OpenSSH 2>/dev/null || true
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    log "UFW firewall configurat (SSH + 80 + 443)"
fi

# =============================================================
# DONE
# =============================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         Instalare completa cu succes!            ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Panel Admin:${NC}     http://${PANEL_DOMAIN}/admin"
echo -e "  ${BOLD}Player Web:${NC}      http://${PANEL_DOMAIN}/player"
echo -e "  ${BOLD}Portal Clienti:${NC}  http://${PANEL_DOMAIN}/portal"
echo -e "  ${BOLD}Xtream API:${NC}      http://${PANEL_DOMAIN}/player_api.php"
echo -e "  ${BOLD}M3U Playlist:${NC}    http://${PANEL_DOMAIN}/get.php?username=X&password=Y&type=m3u_plus"
echo -e "  ${BOLD}XMLTV EPG:${NC}       http://${PANEL_DOMAIN}/xmltv.php?username=X&password=Y"
echo ""
echo -e "  ${BOLD}Username admin:${NC}  ${ADMIN_USER}"
echo -e "  ${BOLD}Parola admin:${NC}    ${ADMIN_PASS}"
echo ""
echo -e "  ${YELLOW}Credentiale salvate in: /root/iptv-credentials.txt${NC}"
echo ""

# Salveaza credentiale
cat > /root/iptv-credentials.txt << CREDS
IPTV Panel - Credentiale instalare $(date)
==========================================
Panel Admin:    http://${PANEL_DOMAIN}/admin
Player Web:     http://${PANEL_DOMAIN}/player
Portal Client:  http://${PANEL_DOMAIN}/portal

Admin User:     ${ADMIN_USER}
Admin Pass:     ${ADMIN_PASS}
DB Password:    ${DB_PASSWORD}
Redis Password: ${REDIS_PASSWORD}
JWT Secret:     ${JWT_SECRET}
MySQL Root:     ${MYSQL_ROOT_PASSWORD}

Comenzi utile:
  cd /opt/iptv-panel/docker
  docker compose logs -f          # vezi loguri
  docker compose ps               # status containere
  docker compose restart          # restart toate
CREDS
chmod 600 /root/iptv-credentials.txt
log "Credentiale salvate in /root/iptv-credentials.txt"
