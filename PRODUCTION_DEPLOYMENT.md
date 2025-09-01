# Project Claw - Production Deployment Guide

## Overview

This guide covers deploying Project Claw in a production environment using Docker containers with proper security, performance, and reliability configurations.

## Production Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │────│  Astro Frontend │    │   Hono API      │
│   (Port 80/443) │    │   (Port 3000)   │    │   (Port 3001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                └───────────────────────┘
                                         │
                                ┌─────────────────┐
                                │ SQLite Database │
                                │  (Persistent)   │
                                └─────────────────┘
```

## Quick Start

### 1. Prepare Environment

```bash
# Copy and configure production environment
cp .env.production .env.prod

# Edit .env.prod with your production values
# - MAL_CLIENT_ID and MAL_CLIENT_SECRET
# - Strong JWT_SECRET and SESSION_SECRET
# - Production CORS_ORIGIN
```

### 2. Deploy

**Windows:**
```cmd
deploy-production.bat
```

**Linux/macOS:**
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

### 3. Verify Deployment

- Frontend: http://localhost:3000 (Astro preview server)
- API: http://localhost:3001 (Hono API server)
- Health Check: http://localhost:3001/api/health

**Note:** Both servers bind to `0.0.0.0` inside the container for proper Docker networking.

## Production Features

### 🔒 Security
- **Non-root user**: Application runs as unprivileged user
- **Security headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Rate limiting**: API and general request limits
- **Input validation**: All API inputs validated
- **CORS protection**: Configurable origin restrictions

### 🚀 Performance
- **Multi-stage build**: Optimized Docker image size
- **Gzip compression**: Reduced bandwidth usage
- **Static file caching**: Long-term caching for assets
- **Connection pooling**: Efficient database connections
- **Health checks**: Automatic container restart on failure

### 📊 Monitoring
- **Health endpoints**: `/api/health` for monitoring
- **Structured logging**: JSON logs with rotation
- **Graceful shutdown**: Proper signal handling
- **Database migrations**: Automatic schema updates

### 🔄 Reliability
- **Restart policies**: Automatic container restart
- **Database persistence**: SQLite data survives restarts
- **Migration system**: Safe database schema updates
- **Error handling**: Comprehensive error recovery

## Configuration Files

### Core Files
- `Dockerfile.prod` - Production Docker image
- `docker-compose.prod.yml` - Production container orchestration
- `docker-entrypoint.prod.sh` - Production startup script
- `.env.prod` - Production environment variables

### Optional Files
- `nginx.conf` - Reverse proxy configuration
- SSL certificates in `./ssl/` directory

## Management Commands

### Start Production
```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Stop Production
```bash
docker-compose -f docker-compose.prod.yml down
```

### View Logs
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Database Management
```bash
# Check migration status
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate:status

# Run migrations
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate:run

# Verify database
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate:verify
```

### Update Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

## With Nginx Reverse Proxy

For production with SSL and advanced routing:

```bash
# Start with Nginx
docker-compose -f docker-compose.prod.yml --profile with-nginx --env-file .env.prod up -d
```

### SSL Configuration

1. Place SSL certificates in `./ssl/` directory:
   - `cert.pem` - SSL certificate
   - `key.pem` - Private key

2. Uncomment HTTPS server block in `nginx.conf`

3. Update `CORS_ORIGIN` in `.env.prod` to use HTTPS

## Environment Variables

### Required
- `MAL_CLIENT_ID` - MyAnimeList API client ID
- `MAL_CLIENT_SECRET` - MyAnimeList API client secret

### Security
- `JWT_SECRET` - Strong secret for JWT tokens
- `SESSION_SECRET` - Strong secret for sessions
- `CORS_ORIGIN` - Allowed origins for CORS

### Optional
- `LOG_LEVEL` - Logging level (info, warn, error)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window
- `REQUEST_TIMEOUT` - API request timeout

## Monitoring and Maintenance

### Health Checks
- Application: `http://localhost:3001/api/health`
- Database: Automatic integrity checks on startup
- Container: Built-in Docker health checks

### Log Management
- Logs stored in `./logs/` directory
- Automatic log rotation (10MB max, 3 files)
- JSON format for structured logging

### Database Backups
```bash
# Backup database
cp ./data/anime.db ./backups/anime-$(date +%Y%m%d).db

# Restore database
cp ./backups/anime-20240901.db ./data/anime.db
docker-compose -f docker-compose.prod.yml restart app
```

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001
```

**Database issues:**
```bash
# Reset database (CAUTION: Data loss!)
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate:reset
```

**Container won't start:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check container status
docker-compose -f docker-compose.prod.yml ps
```

### Performance Tuning

**For high traffic:**
1. Increase rate limits in `nginx.conf`
2. Scale containers: `docker-compose up --scale app=3`
3. Use external database (PostgreSQL/MySQL)
4. Add Redis for caching

**For low resources:**
1. Reduce worker connections in `nginx.conf`
2. Lower rate limits
3. Disable unnecessary features

## Security Checklist

- [ ] Strong secrets in `.env.prod`
- [ ] CORS origins configured correctly
- [ ] SSL certificates installed (if using HTTPS)
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Non-root user in containers
- [ ] Database file permissions secured
- [ ] Log files protected

## Production Deployment Complete! 🎉

Your Project Claw application is now ready for production deployment with enterprise-grade security, performance, and reliability features.