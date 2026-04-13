#!/usr/bin/env bash
# deploy/setup-us-runner.sh — run once on the US server to set up a second runner
# The runner connects to HK's Postgres/Redis via an SSH tunnel.
set -euo pipefail

HK_HOST="ubuntu@proxyhk.itluobo.com"
DEPLOY_DIR="/root/openworkspace-runner"

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo "==> Creating deployment directory..."
mkdir -p "$DEPLOY_DIR"
cp runner.env "$DEPLOY_DIR/.env"
cp docker-compose.runner.yml "$DEPLOY_DIR/docker-compose.yml"

echo "==> Setting up SSH tunnel service (HK Postgres + Redis → localhost)..."
cat > /etc/systemd/system/ow-tunnel.service <<'EOF'
[Unit]
Description=OpenWorkspace SSH tunnel to HK (Postgres + Redis)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/ssh \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=60 \
    -o ExitOnForwardFailure=yes \
    -N \
    -L 15432:127.0.0.1:5432 \
    -L 16379:127.0.0.1:6379 \
    ubuntu@proxyhk.itluobo.com
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ow-tunnel.service

echo "==> Waiting for tunnel to establish..."
sleep 5

echo "==> Pulling runner image..."
cd "$DEPLOY_DIR"
docker compose pull

echo "==> Starting runner..."
docker compose up -d

echo ""
echo "Done! Runner is connecting to HK via SSH tunnel."
echo "Check: docker compose -f $DEPLOY_DIR/docker-compose.yml logs -f"
