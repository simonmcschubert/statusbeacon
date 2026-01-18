#!/bin/bash
set -e

# Example: Sync config files to production server
# Usage: ./update-config.sh [server]
#
# This script uploads config.yml and monitors.yml to the server.
# The StatusBeacon file watcher will automatically detect changes
# and reload the configuration - no service restart needed!
#
# Setup:
# 1. Copy this script to your private config directory
# 2. Place your config.yml and monitors.yml in the same directory
# 3. Update the SERVER and CONFIG_PATH variables below
# 4. Run: ./update-config.sh

# ============================================
# CONFIGURATION - Update these for your setup
# ============================================
SERVER="${1:-user@your-server.com}"
CONFIG_PATH="/var/data/statusbeacon"

# ============================================
# Script logic (no changes needed below)
# ============================================

# SSH options
SSH_OPTS="-o ConnectTimeout=30 -o ServerAliveInterval=15"
CONTROL_PATH="/tmp/ssh-statusbeacon-%r@%h:%p"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$CONTROL_PATH -o ControlPersist=60"

# Get the script's directory (where config files are located)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cleanup function
cleanup() {
    ssh -O exit -o ControlPath="$CONTROL_PATH" "$SERVER" 2>/dev/null || true
}
trap cleanup EXIT

# Connect
echo "🔌 Connecting to $SERVER..."
if ! ssh $SSH_MASTER_OPTS "$SERVER" "echo 'ok'" > /dev/null 2>&1; then
    echo "❌ Cannot connect to $SERVER"
    exit 1
fi
echo "  ✓ Connected"
echo ""

# Find config files
echo "📁 Syncing config files to $CONFIG_PATH..."
CONFIG_FILES=""
[ -f "config.yml" ] && CONFIG_FILES="$CONFIG_FILES config.yml" && echo "  ✓ Found config.yml"
[ -f "monitors.yml" ] && CONFIG_FILES="$CONFIG_FILES monitors.yml" && echo "  ✓ Found monitors.yml"

if [ -z "$CONFIG_FILES" ]; then
    echo "❌ No config files found"
    exit 1
fi

echo ""

# Upload
echo "📤 Uploading..."
scp -o ControlPath="$CONTROL_PATH" $CONFIG_FILES "$SERVER:$CONFIG_PATH/"
echo "  ✓ Files uploaded"

echo ""
echo "✅ Config sync complete!"
echo "   The file watcher will automatically reload the configuration."
