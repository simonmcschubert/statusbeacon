#!/bin/bash
set -e

# Example: Deploy StatusBeacon to production server
# 
# RECOMMENDED: Copy this script to your private config folder:
#   cp scripts/deploy.example.sh ~/private-configs/statusbeacon/deploy.sh
#
# Then update SERVER, APP_PATH, and CONFIG_PATH for your setup.
#
# Usage: ./deploy.sh

# ============================================
# CONFIGURATION - Update these for your setup
# ============================================
SERVER="user@your-server.com"
APP_PATH="/var/www/statusbeacon"
CONFIG_PATH="/var/data/statusbeacon"
SERVICE_NAME="statusbeacon"

# Path to your app source (update this)
APP_SOURCE_DIR="$HOME/dev/statusbeacon"

# ============================================
# Script logic (modify as needed)
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_SOURCE_DIR"

echo "🚀 Deploying StatusBeacon to $SERVER..."
echo ""

# Run basic checks locally
echo "🧪 Running pre-deployment checks..."

echo "  → Checking TypeScript..."
if ! npm run build > /dev/null 2>&1; then
    echo "❌ TypeScript compilation failed"
    npm run build
    exit 1
fi
echo "  ✓ TypeScript OK"

echo "  → Building frontend..."
cd client
if ! npm run build > /dev/null 2>&1; then
    echo "❌ Frontend build failed"
    npm run build
    exit 1
fi
cd "$APP_SOURCE_DIR"
echo "  ✓ Frontend OK"

echo "✅ Pre-deployment checks passed"
echo ""

# Deploy to server
echo "📦 Deploying to server..."

ssh -t "$SERVER" bash -s "$APP_PATH" << 'REMOTESCRIPT'
    set -e
    APP_PATH="$1"
    cd "$APP_PATH"
    
    echo "  → Pulling latest code..."
    sudo -u www-data git fetch origin main
    sudo -u www-data git reset --hard origin/main
    
    echo "  → Installing dependencies..."
    sudo -u www-data npm ci --omit=dev
    cd client && sudo -u www-data npm ci && cd ..
    
    echo "  → Building..."
    sudo -u www-data npm run build
    cd client && sudo -u www-data npm run build && cd ..
REMOTESCRIPT
echo "  ✓ Code deployed"
echo ""

# Upload config files (if they exist in same directory as this script)
if [ -f "$SCRIPT_DIR/config.yml" ] || [ -f "$SCRIPT_DIR/monitors.yml" ]; then
    echo "📤 Uploading config files..."
    ssh "$SERVER" "sudo mkdir -p $CONFIG_PATH && sudo chown www-data:www-data $CONFIG_PATH"
    [ -f "$SCRIPT_DIR/config.yml" ] && scp "$SCRIPT_DIR/config.yml" "$SERVER:$CONFIG_PATH/"
    [ -f "$SCRIPT_DIR/monitors.yml" ] && scp "$SCRIPT_DIR/monitors.yml" "$SERVER:$CONFIG_PATH/"
    ssh "$SERVER" "sudo chown www-data:www-data $CONFIG_PATH/*.yml 2>/dev/null || true"
    echo "  ✓ Config files uploaded"
    echo ""
fi

# Restart service
echo "🔄 Restarting service..."
ssh "$SERVER" bash -s "$SERVICE_NAME" << 'REMOTESCRIPT'
    set -e
    SERVICE_NAME="$1"
    sudo systemctl restart "$SERVICE_NAME"
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "  ✓ Service is running"
    else
        echo "  ❌ Service failed to start"
        sudo journalctl -u "$SERVICE_NAME" -n 20 --no-pager
        exit 1
    fi
REMOTESCRIPT

echo ""
echo "✅ Deployment complete!"
