#!/bin/bash

# Status Page - Quick Start Script
# One command to set up and run everything

echo "🚀 Status Page - Quick Start"
echo "============================"
echo ""

# Run setup
echo "Step 1: Running setup..."
bash scripts/setup-local.sh

if [ $? -eq 0 ]; then
    echo ""
    echo "Step 2: Starting services..."
    bash scripts/test-local.sh
else
    echo "❌ Setup failed. Please check the error messages above."
    exit 1
fi
