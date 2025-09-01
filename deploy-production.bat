@echo off
REM Production Deployment Script for Project Claw (Windows)

echo 🚀 Starting Project Claw Production Deployment...

REM Check if .env.prod exists
if not exist .env.prod (
    echo ❌ Error: .env.prod file not found!
    echo 📝 Please copy .env.production to .env.prod and configure your production values
    exit /b 1
)

REM Create necessary directories
echo 📁 Creating necessary directories...
if not exist data mkdir data
if not exist logs mkdir logs
if not exist ssl mkdir ssl

REM Build and start the production containers
echo 🏗️  Building production Docker image...
docker-compose -f docker-compose.prod.yml build --no-cache

echo 🔄 Starting production services...
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

REM Wait for services to be healthy
echo ⏳ Waiting for services to be healthy...
timeout /t 10 /nobreak > nul

echo ✅ Production deployment initiated!
echo.
echo 🌐 Application URLs:
echo    Frontend: http://localhost:3000
echo    API: http://localhost:3001
echo    Health Check: http://localhost:3001/api/health
echo.
echo 📊 To check logs:
echo    docker-compose -f docker-compose.prod.yml logs -f
echo.
echo 🛑 To stop:
echo    docker-compose -f docker-compose.prod.yml down