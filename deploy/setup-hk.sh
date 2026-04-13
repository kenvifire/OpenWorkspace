#!/usr/bin/env bash
# deploy/setup-hk.sh — run once on the HK server to bootstrap OpenWorkspace
set -euo pipefail

DEPLOY_DIR="/home/ubuntu/openworkspace"

echo "==> Creating deployment directory..."
mkdir -p "$DEPLOY_DIR"

echo "==> Copying files..."
cp docker-compose.yml "$DEPLOY_DIR/"
cp .env "$DEPLOY_DIR/"

echo "==> Installing nginx configs..."
sudo cp nginx/openworkspace.itluobo.com.conf     /etc/nginx/sites-available/
sudo cp nginx/openworkspace-api.itluobo.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/openworkspace.itluobo.com.conf     /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/openworkspace-api.itluobo.com.conf /etc/nginx/sites-enabled/

echo "==> Testing nginx config..."
sudo nginx -t

echo "==> Reloading nginx (HTTP only, before certs)..."
sudo systemctl reload nginx

echo "==> Issuing SSL certificates..."
sudo certbot certonly --webroot -w /var/www/html \
    -d openworkspace.itluobo.com \
    --non-interactive --agree-tos -m admin@itluobo.com

sudo certbot certonly --webroot -w /var/www/html \
    -d openworkspace-api.itluobo.com \
    --non-interactive --agree-tos -m admin@itluobo.com

echo "==> Reloading nginx with SSL..."
sudo systemctl reload nginx

echo "==> Logging in to GitHub Container Registry..."
echo "  (needs a GitHub PAT with read:packages scope)"
echo "  Run: docker login ghcr.io -u <your-github-username>"

echo "==> Pulling images..."
cd "$DEPLOY_DIR"
docker compose pull

echo "==> Running database migrations..."
docker compose run --rm api sh -c "npx prisma migrate deploy"

echo "==> Starting services..."
docker compose up -d

echo ""
echo "Done! Check status with: docker compose -f $DEPLOY_DIR/docker-compose.yml ps"
