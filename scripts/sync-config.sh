#!/bin/bash
set -e

# Sync config files to production server
# Usage: ./scripts/sync-config.sh [server]
#
# This script uploads config.yml and monitors.yml to the server
# and reloads the service. Use this for quick config changes
# without a full deploy.

# SSH options - use ControlMaster to reuse a single connection
SSH_OPTS="-o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=3"
CONTROL_PATH="/tmp/ssh-status-page-%r@%h:%p"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$CONTROL_PATH -o ControlPersist=60"

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

# Cleanup function to close SSH master connection
cleanup() {
    ssh -O exit -o ControlPath="$CONTROL_PATH" "$SERVER" 2>/dev/null || true
}
trap cleanup EXIT

# Establish master connection
echo "🔌 Connecting to $SERVER..."
if ! ssh $SSH_MASTER_OPTS "$SERVER" "echo 'ok'" > /dev/null 2>&1; then
    echo "❌ Cannot connect to $SERVER"
    echo "   Check your network connection and SSH configuration"
    exit 1
fi
echo "  ✓ Connected"
echo ""

echo "📁 Syncing config files..."

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

# Upload all config files in one scp call, then move them
echo "📤 Uploading config files..."
scp -o ControlPath="$CONTROL_PATH" $CONFIG_FILES "$SERVER:/tmp/"
echo "  ✓ Files uploaded"

# Move files and reload service in one SSH call
echo ""
echo "🔄 Installing configs and reloading service..."
ssh -o ControlPath="$CONTROL_PATH" "$SERVER" bash -s "$APP_PATH" << 'REMOTESCRIPT'
    set -e
    APP_PATH="$1"
    
    # Move config files
    [ -f /tmp/config.yml ] && sudo mv /tmp/config.yml "$APP_PATH/config/config.yml"
    [ -f /tmp/monitors.yml ] && sudo mv /tmp/monitors.yml "$APP_PATH/config/monitors.yml"
    
    # Fix ownership
    sudo chown -R www-data:www-data "$APP_PATH/config/"
    
    # Reload service
    sudo systemctl reload status-page 2>/dev/null || sudo systemctl restart status-page
REMOTESCRIPT
echo "  ✓ Service reloaded"

echo ""
echo "✅ Config sync complete!"
