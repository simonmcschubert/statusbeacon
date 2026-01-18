#!/bin/bash
set -e

# Development script for statusbeacon
# Runs both backend and frontend in development mode
#
# Usage:
#   ./scripts/dev.sh                    # Uses config/ folder or example configs
#   ./scripts/dev.sh /path/to/config    # Uses external config folder
#
# For external config, set CONFIG_PATH and MONITORS_PATH:
#   export CONFIG_PATH=~/private/statusbeacon/config.yml
#   export MONITORS_PATH=~/private/statusbeacon/monitors.yml
#   ./scripts/dev.sh

# Get the script's directory and app root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

# Support passing config folder as argument
if [ -n "$1" ] && [ -d "$1" ]; then
    export CONFIG_PATH="$1/config.yml"
    export MONITORS_PATH="$1/monitors.yml"
    echo "📁 Using external config from: $1"
fi

# Check if config exists (either local or via env vars)
if [ -z "$CONFIG_PATH" ]; then
    if [ ! -f "config/config.yml" ]; then
        echo "⚠️  No config/config.yml found."
        echo "   Option 1: Copy example configs:"
        echo "     cp config/config.example.yml config/config.yml"
        echo "     cp config/monitors.example.yml config/monitors.yml"
        echo ""
        echo "   Option 2: Use external config:"
        echo "     ./scripts/dev.sh /path/to/your/config/folder"
        echo ""
        echo "   Option 3: Set environment variables:"
        echo "     export CONFIG_PATH=/path/to/config.yml"
        echo "     export MONITORS_PATH=/path/to/monitors.yml"
        exit 1
    fi
else
    echo "📁 CONFIG_PATH: $CONFIG_PATH"
    echo "📁 MONITORS_PATH: $MONITORS_PATH"
fi

echo ""
echo "🚀 Starting development servers..."
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd client && npm install && cd ..
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "🔧 Starting backend on port 3000..."
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend on port 5173..."
cd client
npm run dev &
FRONTEND_PID=$!
cd "$APP_DIR"

echo ""
echo "✅ Development servers running:"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID
