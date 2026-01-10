#!/bin/bash

# Status Page - Local Test Runner
# This script starts all services and runs a quick test

set -e

echo "🧪 Status Page - Local Test"
echo "==========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker services are running
echo "📋 Checking services..."

if ! docker ps | grep -q status-page-postgres; then
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    echo "Run: docker-compose up -d postgres redis"
    exit 1
fi

if ! docker ps | grep -q status-page-redis; then
    echo -e "${RED}❌ Redis is not running${NC}"
    echo "Run: docker-compose up -d postgres redis"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"
echo -e "${GREEN}✅ Redis is running${NC}"
echo ""

# Start backend in background
echo "🚀 Starting backend server..."
npm run dev > /tmp/status-page-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
echo "   Waiting for backend to be ready..."
sleep 5

# Check if backend is running
if ! ps -p $BACKEND_PID > /dev/null; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    echo "Check logs: tail -f /tmp/status-page-backend.log"
    exit 1
fi

# Test backend health endpoint
MAX_RETRIES=10
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "${RED}❌ Backend health check failed${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
echo ""

# Start frontend in background
echo "🎨 Starting frontend server..."
cd client
npm run dev > /tmp/status-page-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo "   Waiting for frontend to be ready..."
sleep 5

# Check if frontend is running
if ! ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${RED}❌ Frontend failed to start${NC}"
    echo "Check logs: tail -f /tmp/status-page-frontend.log"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Test frontend
MAX_RETRIES=10
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is serving${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "${RED}❌ Frontend is not accessible${NC}"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
echo ""

# Run API tests
echo "🧪 Testing API endpoints..."

# Test /health
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo -e "${GREEN}✅ GET /health${NC}"
else
    echo -e "${RED}❌ GET /health${NC}"
fi

# Test /api/config
if curl -s http://localhost:3000/api/config | grep -q "app"; then
    echo -e "${GREEN}✅ GET /api/config${NC}"
else
    echo -e "${RED}❌ GET /api/config${NC}"
fi

# Test /api/monitors
if curl -s http://localhost:3000/api/monitors | grep -q "monitors"; then
    echo -e "${GREEN}✅ GET /api/monitors${NC}"
else
    echo -e "${RED}❌ GET /api/monitors${NC}"
fi

# Test /api/incidents
if curl -s http://localhost:3000/api/incidents | grep -q "incidents"; then
    echo -e "${GREEN}✅ GET /api/incidents${NC}"
else
    echo -e "${RED}❌ GET /api/incidents${NC}"
fi

echo ""
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo ""
echo "📊 View logs:"
echo "   Backend:  tail -f /tmp/status-page-backend.log"
echo "   Frontend: tail -f /tmp/status-page-frontend.log"
echo ""
echo "🛑 To stop services:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   docker-compose down"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "✅ Services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Keep script running
wait $BACKEND_PID $FRONTEND_PID
