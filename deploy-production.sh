#!/bin/bash

# Production Deployment Script for Project Claw
set -e

echo "🚀 Starting Project Claw Production Deployment..."

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ Error: .env.prod file not found!"
    echo "📝 Please copy .env.production to .env.prod and configure your production values"
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p data logs ssl

# Set proper permissions
chmod 755 data logs
chmod 600 .env.prod

# Build and start the production containers
echo "🏗️  Building production Docker image..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🔄 Starting production services..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check if services are running
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ Production deployment successful!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://localhost:3000"
    echo "   API: http://localhost:3001"
    echo "   Health Check: http://localhost:3001/api/health"
    echo ""
    echo "📊 To check logs:"
    echo "   docker-compose -f docker-compose.prod.yml logs -f"
    echo ""
    echo "🛑 To stop:"
    echo "   docker-compose -f docker-compose.prod.yml down"
else
    echo "❌ Deployment failed! Check logs:"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi