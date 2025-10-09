#!/bin/bash
# Stop the Jekyll development server

echo "Stopping Jekyll development server..."

# Stop and remove the container
docker compose down

echo "Jekyll server stopped"