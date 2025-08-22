#!/bin/sh

echo "🚀 Starting Project Claw Development Environment..."

# Create data directory for SQLite database
mkdir -p /app/data

# Start API server in background
echo "🔧 Starting API server on port 3001..."
npm run api:dev &

# Start Astro frontend server
echo "🌟 Starting frontend server on port 3000..."
npm run dev

# Keep container running
wait