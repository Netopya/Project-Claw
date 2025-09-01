#!/bin/sh

echo "🚀 Starting Project Claw Production Environment..."

# Create data directory for SQLite database
mkdir -p /app/data

# Set production environment
export NODE_ENV=production

# Run database migrations
echo "🔄 Running database migrations..."
npm run db:migrate:run

# Verify database integrity
echo "🔍 Verifying database integrity..."
npm run db:migrate:verify

# Start API server in background
echo "🔧 Starting API server on port 3001..."
npm run api:start &
API_PID=$!

# Start Astro preview server (serves built static files)
echo "🌟 Starting frontend server on port 3000..."
npm run preview -- --port 3000 --host 0.0.0.0 &
FRONTEND_PID=$!

# Function to handle shutdown gracefully
shutdown() {
    echo "🛑 Shutting down gracefully..."
    kill $API_PID $FRONTEND_PID 2>/dev/null
    wait $API_PID $FRONTEND_PID 2>/dev/null
    echo "✅ Shutdown complete"
    exit 0
}

# Trap signals for graceful shutdown
trap shutdown SIGTERM SIGINT

# Wait for both processes
wait