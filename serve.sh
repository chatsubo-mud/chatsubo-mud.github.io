#!/bin/bash
# Local Jekyll development server script for Chatsubo Blog (Docker)

echo "Starting Chatsubo Blog local server with Docker..."
echo "Make sure you're in the blog directory"

# Check if we're in the right directory
if [ ! -f "_config.yml" ]; then
    echo "ERROR: Not in blog directory. Please cd to the blog directory first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "ERROR: Docker is not running. Please start Docker first."
    exit 1
fi

# Stop any existing container
echo "Stopping any existing Jekyll container..."
docker compose down 2>/dev/null || true

# Build and start the container
echo "Building Jekyll Docker container..."
docker compose build

echo "Starting Jekyll server..."
echo "Blog will be available at: http://darkwing:5000"
echo "Server will auto-reload when you make changes"
echo "Press Ctrl+C to stop the server"
echo ""

# Start Jekyll with Docker Compose
docker compose up -d