#!/bin/bash
set -e

# Deploy statusbeacon to production server
# Usage: ./scripts/deploy.sh [server]
# Server defaults to deploy.server from config/config.yml

# Get the script's directory and app root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

# Configuration - read from config.yml or use argument
if [ -n "$1" ]; then
    SERVER="$1"
elif command -v yq &> /dev/null && [ -f "config/config.yml" ]; then
    SERVER=$(yq '.deploy.server' config/config.yml)
    if [ "$SERVER" = "null" ] || [ -z "$SERVER" ]; then
        echo "❌ No server configured in config/config.yml (deploy.server)"
        echo "Usage: ./scripts/deploy.sh [server]"
        exit 1
    fi
else
    echo "❌ No server specified and config/config.yml not found or yq not installed"
    echo "Usage: ./scripts/deploy.sh [server]"
    echo "Or add deploy.server to config/config.yml"
    exit 1
fi

APP_PATH="/var/www/statusbeacon"
SERVICE_NAME="statusbeacon"

echo "🚀 Deploying statusbeacon to $SERVER..."
echo ""

# Run basic checks locally
echo "🧪 Running pre-deployment checks..."

# Check TypeScript compilation
echo "  ✓ Checking TypeScript..."
if ! npm run build > /dev/null 2>&1; then
    echo "❌ TypeScript compilation failed"
    npm run build
    exit 1
fi

# Check frontend build
echo "  ✓ Building frontend..."
cd client
if ! npm run build > /dev/null 2>&1; then
    echo "❌ Frontend build failed"
    npm run build
    exit 1
fi
cd "$APP_DIR"

echo "✅ Pre-deployment checks passed"
echo ""

# Deploy to server
echo "📦 Deploying to server..."

ssh -t "$SERVER" << 'REMOTESCRIPT'
    set -e
    cd /var/www/statusbeacon
    
    echo "  → Pulling latest code..."
    sudo -u www-data git fetch origin main
    sudo -u www-data git reset --hard origin/main
    
    echo "  → Installing backend dependencies..."
    sudo -u www-data npm install
    
    echo "  → Installing frontend dependencies..."
    cd client && sudo -u www-data npm install && cd ..
    
    echo "  → Building TypeScript..."
    sudo -u www-data npm run build
    
    echo "  → Building frontend..."
    cd client && sudo -u www-data npm run build && cd ..
    
    echo "  → Pruning dev dependencies..."
    sudo -u www-data npm prune --production
    
    echo "  → Restarting service..."
    sudo systemctl restart statusbeacon
    
    echo "  → Checking service status..."
    sleep 2
    if systemctl is-active --quiet statusbeacon; then
        echo "  ✓ Service is running"
    else
        echo "  ❌ Service failed to start"
        sudo journalctl -u statusbeacon -n 20 --no-pager
        exit 1
    fi
REMOTESCRIPT

echo ""
echo "✅ Deployment complete!"
