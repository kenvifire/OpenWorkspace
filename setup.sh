#!/usr/bin/env bash
# =============================================================================
#  OpenWorkspace — full setup script
#  Installs all system dependencies, configures env files, migrates DB.
#
#  Supported:  macOS (Homebrew), Ubuntu/Debian, RHEL/Fedora/Amazon Linux
#  Run once:   bash setup.sh
# =============================================================================
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${BLUE}▶  $*${RESET}\n"; }
die()     { error "$*"; exit 1; }

command_exists() { command -v "$1" &>/dev/null; }

# ── Detect OS ─────────────────────────────────────────────────────────────────
OS="unknown"
case "$(uname -s)" in
  Darwin) OS="macos" ;;
  Linux)
    if [[ -f /etc/os-release ]]; then
      # shellcheck source=/dev/null
      source /etc/os-release
      case "$ID" in
        ubuntu|debian|linuxmint|pop)          OS="debian" ;;
        rhel|centos|fedora|amzn|rocky|alma)   OS="rhel"   ;;
        *)                                    OS="linux-other" ;;
      esac
    fi
    ;;
esac
info "Detected OS: ${OS}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Step counter ──────────────────────────────────────────────────────────────
STEP=0
step() { STEP=$((STEP+1)); echo -e "\n${BOLD}Step ${STEP}: $*${RESET}"; }

# ── Prompt helpers ────────────────────────────────────────────────────────────
ask() {
  local var="$1" prompt="$2" default="${3:-}"
  if [[ -n "$default" ]]; then
    read -rp "  ${prompt} [${default}]: " val
    val="${val:-$default}"
  else
    read -rp "  ${prompt}: " val
    while [[ -z "$val" ]]; do
      read -rp "  (required) ${prompt}: " val
    done
  fi
  eval "$var=\"\$val\""
}

ask_secret() {
  local var="$1" prompt="$2"
  read -rsp "  ${prompt}: " val; echo
  while [[ -z "$val" ]]; do
    read -rsp "  (required) ${prompt}: " val; echo
  done
  eval "$var=\"\$val\""
}

# ── docker compose helper — works with both plugin (v2) and standalone ────────
docker_compose() {
  if docker compose version &>/dev/null 2>&1; then
    docker compose "$@"
  elif command_exists docker-compose; then
    docker-compose "$@"
  else
    die "'docker compose' not found. Upgrade Docker to 20.10+ or install the Compose plugin."
  fi
}

# =============================================================================
echo -e "${BOLD}"
echo "  ╔════════════════════════════════════════════╗"
echo "  ║        OpenWorkspace — Setup Script        ║"
echo "  ╚════════════════════════════════════════════╝"
echo -e "${RESET}"
echo "  This script will install and configure:"
echo "    • Homebrew (macOS) / system packages (Linux)"
echo "    • Node.js 22 via nvm"
echo "    • pnpm"
echo "    • Python 3.11+ and pip (for the agent runner)"
echo "    • Docker + Docker Compose"
echo "    • All project npm + Python dependencies"
echo "    • Environment files (with interactive prompts)"
echo "    • PostgreSQL + Redis (via Docker Compose)"
echo "    • Prisma client + database migrations"
echo ""
read -rp "  Press Enter to continue or Ctrl+C to cancel…"

cd "$REPO_ROOT"

# =============================================================================
step "Installing system package manager"

if [[ "$OS" == "macos" ]]; then
  if ! command_exists brew; then
    info "Installing Homebrew…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [[ -x /opt/homebrew/bin/brew ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -x /usr/local/bin/brew ]]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
    success "Homebrew installed"
  else
    success "Homebrew $(brew --version | head -1)"
  fi

elif [[ "$OS" == "debian" ]]; then
  info "Updating apt…"
  sudo apt-get update -qq
  sudo apt-get install -y -qq curl git ca-certificates gnupg lsb-release \
    python3 python3-pip python3-venv
  success "apt packages ready"

elif [[ "$OS" == "rhel" ]]; then
  info "Updating dnf/yum…"
  sudo dnf install -y curl git ca-certificates gnupg2 python3 python3-pip 2>/dev/null \
    || sudo yum install -y curl git ca-certificates gnupg2 python3 python3-pip
  success "dnf/yum packages ready"

else
  warn "Unrecognised OS — skipping package manager setup. Ensure curl, git, and python3 are installed."
fi

# =============================================================================
step "Installing Node.js 22 (via nvm)"

NODE_TARGET="22"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ ! -d "$NVM_DIR" ]]; then
  info "Installing nvm…"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  success "nvm installed"
fi

export NVM_DIR
# shellcheck source=/dev/null
\. "$NVM_DIR/nvm.sh"

info "Installing Node.js ${NODE_TARGET}…"
nvm install "$NODE_TARGET"
nvm use "$NODE_TARGET"
nvm alias default "$NODE_TARGET"
success "Node.js $(node --version)"

npm install -g npm@latest --silent

# =============================================================================
step "Installing pnpm"

if ! command_exists pnpm; then
  info "Installing pnpm via npm…"
  npm install -g pnpm
fi
success "pnpm $(pnpm --version)"

# =============================================================================
step "Installing Python 3.11+"

PYTHON_MIN_MINOR=11

find_python() {
  for cmd in python3.13 python3.12 python3.11 python3; do
    if command_exists "$cmd"; then
      local minor
      minor=$("$cmd" -c "import sys; print(sys.version_info.minor)")
      local major
      major=$("$cmd" -c "import sys; print(sys.version_info.major)")
      if [[ "$major" -eq 3 && "$minor" -ge $PYTHON_MIN_MINOR ]]; then
        echo "$cmd"; return 0
      fi
    fi
  done
  return 1
}

if PYTHON=$(find_python); then
  success "Python $($PYTHON --version)"
else
  if [[ "$OS" == "macos" ]]; then
    info "Installing Python 3.13 via Homebrew…"
    brew install python@3.13
    PYTHON="python3.13"
  elif [[ "$OS" == "debian" ]]; then
    info "Installing Python 3.11 via apt…"
    sudo apt-get install -y -qq python3.11 python3.11-pip python3.11-venv
    PYTHON="python3.11"
  elif [[ "$OS" == "rhel" ]]; then
    info "Installing Python 3.11 via dnf…"
    sudo dnf install -y python3.11 python3.11-pip 2>/dev/null \
      || sudo yum install -y python3.11
    PYTHON="python3.11"
  else
    die "Python 3.11+ not found and cannot auto-install on this OS. Please install it manually."
  fi
  success "Python $($PYTHON --version)"
fi

# Ensure pip is available
if ! "$PYTHON" -m pip --version &>/dev/null; then
  info "Installing pip…"
  curl -fsSL https://bootstrap.pypa.io/get-pip.py | "$PYTHON"
fi
success "pip $("$PYTHON" -m pip --version | awk '{print $2}')"

# =============================================================================
step "Installing Docker"

if command_exists docker && docker info &>/dev/null 2>&1; then
  success "Docker already running ($(docker --version | awk '{print $3}' | tr -d ','))"
else
  if [[ "$OS" == "macos" ]]; then
    if ! brew list --cask docker &>/dev/null 2>&1; then
      info "Installing Docker Desktop via Homebrew…"
      brew install --cask docker
    fi
    if ! docker info &>/dev/null 2>/dev/null; then
      info "Starting Docker Desktop…"
      open -a Docker
      echo -n "  Waiting for Docker daemon"
      for i in {1..60}; do
        if docker info &>/dev/null 2>/dev/null; then echo; break; fi
        echo -n "."; sleep 2
        if [[ $i -eq 60 ]]; then
          echo
          die "Docker daemon did not start. Open Docker Desktop manually and re-run."
        fi
      done
    fi
    success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

  elif [[ "$OS" == "debian" ]]; then
    info "Installing Docker Engine…"
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
    success "Docker installed (you may need to log out and back in for group membership)"

  elif [[ "$OS" == "rhel" ]]; then
    info "Installing Docker Engine…"
    sudo dnf -y install dnf-plugins-core 2>/dev/null || sudo yum install -y yum-utils
    sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null \
      || sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null \
      || sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
    success "Docker installed"

  else
    die "Cannot auto-install Docker on this OS. Install it manually: https://docs.docker.com/get-docker/"
  fi
fi

docker_compose version --short | xargs -I{} echo -e "${GREEN}[ok]${RESET}    Docker Compose {}"

# =============================================================================
step "Installing Node.js dependencies"

info "Running pnpm install…"
pnpm install
success "All npm/pnpm dependencies installed"

# =============================================================================
step "Installing Python runner dependencies"

RUNNER_DIR="$REPO_ROOT/apps/runner"
if [[ ! -f "$RUNNER_DIR/requirements.txt" ]]; then
  warn "apps/runner/requirements.txt not found — skipping Python deps"
else
  info "Installing runner requirements…"
  "$PYTHON" -m pip install --quiet -r "$RUNNER_DIR/requirements.txt"
  success "Python runner dependencies installed"
fi

# =============================================================================
step "Configuring environment files"

echo ""
echo -e "  ${YELLOW}You need Clerk API keys (free at clerk.com).${RESET}"
echo "  → https://clerk.com → Create application → Email + Google"
echo "  → Dashboard → API Keys → copy Publishable key + Secret key"
echo ""

# Generate secrets once and reuse across env files
if command_exists openssl; then
  GENERATED_JWT=$(openssl rand -base64 32)
  GENERATED_ENC=$(openssl rand -hex 32)
else
  GENERATED_JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  GENERATED_ENC=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fi

# ── Root .env — used by Docker Compose variable substitution ──────────────────
ROOT_ENV="$REPO_ROOT/.env"
if [[ -f "$ROOT_ENV" ]]; then
  warn ".env already exists — skipping (delete to reconfigure)"
  # shellcheck source=/dev/null
  source "$ROOT_ENV" 2>/dev/null || true
  DB_USER="${POSTGRES_USER:-ow_user}"
  DB_PASS="${POSTGRES_PASSWORD:-ow_password}"
  DB_NAME="${POSTGRES_DB:-openworkspace}"
  DB_PORT="${POSTGRES_PORT:-5432}"
  REDIS_PASS="${REDIS_PASSWORD:-ow_redis_password}"
  REDIS_PORT="${REDIS_PORT_VAR:-6379}"
else
  echo "  --- Database ---"
  ask DB_USER    "PostgreSQL user"     "ow_user"
  ask DB_PASS    "PostgreSQL password" "ow_password"
  ask DB_NAME    "PostgreSQL database" "openworkspace"
  ask DB_PORT    "PostgreSQL port"     "5432"

  echo ""
  echo "  --- Redis ---"
  ask REDIS_PASS "Redis password" "ow_redis_password"
  ask REDIS_PORT "Redis port"     "6379"

  cat > "$ROOT_ENV" <<EOF
# Generated by setup.sh — used by Docker Compose
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=${DB_NAME}
POSTGRES_PORT=${DB_PORT}
REDIS_PASSWORD=${REDIS_PASS}
REDIS_PORT=${REDIS_PORT}
EOF
  success ".env (Docker Compose) created"
fi

# ── apps/api/.env ─────────────────────────────────────────────────────────────
API_ENV="$REPO_ROOT/apps/api/.env"
if [[ -f "$API_ENV" ]]; then
  warn "apps/api/.env already exists — skipping (delete to reconfigure)"
else
  echo ""
  echo "  --- API auth ---"
  warn "JWT_SECRET is for local dev (HS256). In production set CLERK_JWKS_URL instead."
  ask JWT_SECRET "JWT secret" "$GENERATED_JWT"

  echo ""
  echo "  --- Encryption (resource keys) ---"
  ask ENC_SECRET "Encryption secret (32+ hex chars)" "$GENERATED_ENC"

  echo ""
  echo "  --- Stripe (optional — press Enter to skip) ---"
  read -rp "  Stripe secret key   (sk_test_...) [skip]: " STRIPE_SK
  read -rp "  Stripe webhook secret (whsec_...) [skip]: " STRIPE_WH

  cat > "$API_ENV" <<EOF
# Generated by setup.sh

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"
REDIS_HOST=localhost
REDIS_PORT=${REDIS_PORT}
REDIS_PASSWORD=${REDIS_PASS}

# Local dev: HS256 JWT. Production: comment this out and set CLERK_JWKS_URL.
JWT_SECRET="${JWT_SECRET}"
# CLERK_JWKS_URL="https://<your-clerk-domain>.clerk.accounts.dev/.well-known/jwks.json"

ENCRYPTION_SECRET="${ENC_SECRET}"

STRIPE_SECRET_KEY="${STRIPE_SK:-}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WH:-}"

WEB_URL="http://localhost:3000"
PORT=3001
EOF
  success "apps/api/.env created"
fi

# ── apps/app/.env.local ───────────────────────────────────────────────────────
APP_ENV="$REPO_ROOT/apps/app/.env.local"
if [[ -f "$APP_ENV" ]]; then
  warn "apps/app/.env.local already exists — skipping (delete to reconfigure)"
else
  echo ""
  echo "  --- Clerk keys (for the app frontend) ---"
  ask_secret CLERK_PUB "Clerk publishable key (pk_test_...)"
  ask_secret CLERK_SEC "Clerk secret key     (sk_test_...)"

  cat > "$APP_ENV" <<EOF
# Generated by setup.sh

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${CLERK_PUB}"
CLERK_SECRET_KEY="${CLERK_SEC}"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/en/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/en/sign-up"
NEXT_PUBLIC_API_URL="http://localhost:3001"
EOF
  success "apps/app/.env.local created"
fi

# ── apps/website/.env.local ───────────────────────────────────────────────────
WEBSITE_ENV="$REPO_ROOT/apps/website/.env.local"
if [[ -f "$WEBSITE_ENV" ]]; then
  warn "apps/website/.env.local already exists — skipping (delete to reconfigure)"
else
  cat > "$WEBSITE_ENV" <<EOF
# Generated by setup.sh

# URL of the app (used for sign-in / get-started links)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
EOF
  success "apps/website/.env.local created"
fi

# ── apps/runner/.env ──────────────────────────────────────────────────────────
RUNNER_ENV="$REPO_ROOT/apps/runner/.env"
if [[ -f "$RUNNER_ENV" ]]; then
  warn "apps/runner/.env already exists — skipping (delete to reconfigure)"
else
  # Reuse API encryption secret if we captured it; otherwise read from api .env
  if [[ -z "${ENC_SECRET:-}" && -f "$API_ENV" ]]; then
    ENC_SECRET=$(grep '^ENCRYPTION_SECRET=' "$API_ENV" | cut -d'"' -f2)
  fi

  cat > "$RUNNER_ENV" <<EOF
# Generated by setup.sh

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"
REDIS_HOST=localhost
REDIS_PORT=${REDIS_PORT}
REDIS_PASSWORD=${REDIS_PASS}

ENCRYPTION_SECRET="${ENC_SECRET:-}"

# Unique name for this runner instance (for Redis Streams consumer group)
RUNNER_INSTANCE=runner-1
EOF
  success "apps/runner/.env created"
fi

# =============================================================================
step "Starting Docker services"

cd "$REPO_ROOT"
docker_compose up -d

info "Waiting for PostgreSQL…"
for i in {1..30}; do
  if docker_compose exec -T postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}" -q 2>/dev/null; then
    break
  fi
  if [[ $i -eq 30 ]]; then
    die "PostgreSQL did not become ready. Run: docker compose logs postgres"
  fi
  sleep 2
done
success "PostgreSQL ready"

info "Waiting for Redis…"
for i in {1..20}; do
  if docker_compose exec -T redis \
       redis-cli --no-auth-warning -a "${REDIS_PASS}" ping 2>/dev/null | grep -q PONG; then
    break
  fi
  if [[ $i -eq 20 ]]; then
    die "Redis did not become ready. Run: docker compose logs redis"
  fi
  sleep 2
done
success "Redis ready"

# =============================================================================
step "Prisma — generate client & run migrations"

cd "$REPO_ROOT/apps/api"

info "Generating Prisma client…"
npx prisma generate

info "Running migrations…"
# deploy is safe for CI/existing migrations; fall back to dev for a fresh repo
npx prisma migrate deploy 2>/dev/null \
  || npx prisma migrate dev --name init --skip-seed

success "Database schema up to date"
cd "$REPO_ROOT"

# =============================================================================
step "Build verification"

info "Building all packages and apps…"
pnpm run build

success "All packages and apps compiled without errors"

# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  ✓  Setup complete!${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}Start all services:${RESET}"
echo ""
echo -e "    ${BLUE}pnpm dev${RESET}"
echo ""
echo -e "  ${BOLD}URLs:${RESET}"
echo -e "    App      →  ${BLUE}http://localhost:3000${RESET}"
echo -e "    API      →  ${BLUE}http://localhost:3001${RESET}"
echo -e "    Swagger  →  ${BLUE}http://localhost:3001/api/docs${RESET}"
echo -e "    Website  →  ${BLUE}http://localhost:3002${RESET}"
echo ""
echo -e "  ${BOLD}Start the agent runner separately:${RESET}"
echo ""
echo -e "    ${BLUE}cd apps/runner && $PYTHON -m src.main${RESET}"
echo ""
echo -e "  ${BOLD}${YELLOW}Required one-time Clerk dashboard steps:${RESET}"
echo ""
echo -e "  1. ${BOLD}Configure → Sessions → Customize session token${RESET}"
echo -e "     Add these claims so the API can identify users:"
echo -e "     ${YELLOW}{"
echo -e '       "email":      "{{user.primary_email_address}}",'
echo -e '       "first_name": "{{user.first_name}}",'
echo -e '       "last_name":  "{{user.last_name}}",'
echo -e '       "image_url":  "{{user.image_url}}"'
echo -e "     }${RESET}"
echo ""
echo -e "  2. ${BOLD}Configure → SSO Connections → Add Google${RESET}"
echo -e "     (Clerk shared credentials work for local dev)"
echo ""
echo -e "  ${BOLD}Optional — Stripe local webhooks:${RESET}"
if [[ "$OS" == "macos" ]]; then
  echo -e "    ${BLUE}brew install stripe/stripe-cli/stripe${RESET}"
fi
echo -e "    ${BLUE}stripe login${RESET}"
echo -e "    ${BLUE}stripe listen --forward-to localhost:3001/api/billing/webhook/stripe${RESET}"
echo -e "    # Copy the whsec_... into apps/api/.env → STRIPE_WEBHOOK_SECRET"
echo ""

if [[ "$OS" == "debian" || "$OS" == "rhel" ]]; then
  echo -e "  ${YELLOW}Note: Docker was added to your user group."
  echo -e "  You may need to log out and back in before running docker without sudo.${RESET}"
  echo ""
fi
