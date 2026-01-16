#!/bin/bash
set -e

# Sync config files to production server
# Usage: ./scripts/sync-config.sh [server]
#
# This script uploads config.yml and monitors.yml to the server
# and reloads the service. Use this for quick config changes
# without a full deploy.

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
        echo "Usage: ./scripts/sync-config.sh [server]"
        exit 1
    fi
else
    echo "❌ No server specified and config/config.yml not found or yq not installed"
    echo "Usage: ./scripts/sync-config.sh user@server"
    exit 1
fi

# Read app path from config or use default
if command -v yq &> /dev/null && [ -f "config/config.yml" ]; then
    APP_PATH=$(yq '.deploy.path // "/var/www/status-page"' config/config.yml)
else
    APP_PATH="/var/www/status-page"
fi

echo "📁 Syncing config files to $SERVER..."
echo ""

# Check which config files exist locally
CONFIG_FILES=""
if [ -f "config/config.yml" ]; then
    CONFIG_FILES="$CONFIG_FILES config/config.yml"
    echo "  ✓ Found config/config.yml"
else
    echo "  ⚠ config/config.yml not found (skipping)"
fi

if [ -f "config/monitors.yml" ]; then
    CONFIG_FILES="$CONFIG_FILES config/monitors.yml"
    echo "  ✓ Found config/monitors.yml"
else
    echo "  ⚠ config/monitors.yml not found (skipping)"
fi

if [ -z "$CONFIG_FILES" ]; then
    echo ""
    echo "❌ No config files found to sync"
    exit 1
fi

echo ""

# Upload config files
echo "📤 Uploading config files..."
for file in $CONFIG_FILES; do
    rsync -avz --rsync-path="sudo rsync" "$file" "$SERVER:$APP_PATH/$file"
    echo "  ✓ Uploaded $file"
done

# Fix ownership and reload service
echo ""
echo "🔄 Reloading service..."
ssh "$SERVER" << REMOTESCRIPT
    set -e
    sudo chown -R www-data:www-data $APP_PATH/config/
    sudo systemctl reload status-page || sudo systemctl restart status-page
    echo "  ✓ Service reloaded"
REMOTESCRIPT

echo ""
echo "✅ Config sync complete!"
