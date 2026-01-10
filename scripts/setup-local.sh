#!/bin/bash

# Status Page - Local Development Setup Script
# This script sets up and starts the status page application locally

set -e  # Exit on error

echo "🚀 Status Page - Local Development Setup"
echo "========================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  docker-compose not found, trying 'docker compose'"
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "⚠️  Node.js version is $NODE_VERSION, but 20+ is recommended"
fi

echo "✅ Node.js $(node -v)"
echo "✅ Docker installed"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   Installing backend dependencies..."
    npm install
else
    echo "   ✓ Backend dependencies already installed"
fi

if [ ! -d "client/node_modules" ]; then
    echo "   Installing frontend dependencies..."
    cd client && npm install && cd ..
else
    echo "   ✓ Frontend dependencies already installed"
fi
echo ""

# Set up configuration files
echo "⚙️  Setting up configuration..."

if [ ! -f ".env" ]; then
    echo "   Creating .env file..."
    cp .env.example .env
    echo "   ✓ Created .env (edit if needed)"
else
    echo "   ✓ .env already exists"
fi

if [ ! -f "config/config.yml" ]; then
    echo "   Creating config.yml..."
    cp config/config.example.yml config/config.yml
    echo "   ✓ Created config/config.yml"
else
    echo "   ✓ config/config.yml already exists"
fi

if [ ! -f "config/monitors.yml" ]; then
    echo "   Creating monitors.yml..."
    cp config/monitors.example.yml config/monitors.yml
    echo "   ✓ Created config/monitors.yml"
else
    echo "   ✓ config/monitors.yml already exists"
fi
echo ""

# Start Docker services
echo "🐳 Starting Docker services (PostgreSQL & Redis)..."
$DOCKER_COMPOSE up -d postgres redis

# Wait for PostgreSQL to be ready
echo "   Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is accessible
until $DOCKER_COMPOSE exec -T postgres pg_isready -U statuspage &> /dev/null; do
    echo "   PostgreSQL is unavailable - waiting..."
    sleep 2
done
echo "   ✅ PostgreSQL is ready"

# Check if Redis is accessible
echo "   Checking Redis..."
until $DOCKER_COMPOSE exec -T redis redis-cli ping &> /dev/null; do
    echo "   Redis is unavailable - waiting..."
    sleep 2
done
echo "   ✅ Redis is ready"
echo ""

# Run database migrations
echo "🗄️  Running database migrations..."
if npm run db:migrate; then
    echo "   ✅ Database migrations completed"
else
    echo "   ⚠️  Migration script not found or failed"
    echo "   You may need to run migrations manually"
fi
echo ""

# Final instructions
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo ""
echo "1. Edit your monitors in: config/monitors.yml"
echo "2. Start the application:"
echo ""
echo "   Terminal 1 - Backend:"
echo "   $ npm run dev"
echo ""
echo "   Terminal 2 - Frontend:"
echo "   $ cd client && npm run dev"
echo ""
echo "3. Open your browser:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo ""
echo "📝 Useful commands:"
echo "   - View logs:    docker-compose logs -f postgres redis"
echo "   - Stop DB:      docker-compose down"
echo "   - Restart DB:   docker-compose restart postgres redis"
echo ""
