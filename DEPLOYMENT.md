# Deployment Guide

## Quick Start (Development)

### Prerequisites
- Docker & Docker Compose
- Git

### Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd template
```

2. **Configure environment variables**
```bash
# .env file is already configured for development
# Review and update if needed
```

3. **Start all services**
```bash
docker compose up -d
```

4. **Check service health**
```bash
# Check all containers are running
docker compose ps

# Check backend health
curl http://localhost:8000/api/v1/health

# Check detailed health
curl http://localhost:8000/api/v1/health/detailed
```

5. **Access the application**
- Frontend: http://localhost:3001
- Backend API: http://localhost:8000/api/v1
- API Documentation: http://localhost:8000/api/v1/docs
- Database: localhost:5433 (postgres/postgres_password)

### Common Commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart services
docker compose restart backend
docker compose restart frontend

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# Run database migrations
docker compose exec backend alembic upgrade head

# Create admin user
docker compose exec backend python create_admin.py
```

## Production Deployment

### Environment Configuration

1. **Update .env file with production values**

```bash
# Security
AUTH_SECRET=<generate-strong-32+-char-secret>
JWT_SECRET=<same-as-auth-secret>

# Environment
ENVIRONMENT=production

# Database (use managed PostgreSQL in production)
POSTGRES_SERVER=<production-db-host>
POSTGRES_PORT=5432
POSTGRES_USER=<production-user>
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=master_foundation

# API Keys
GEMINI_API_KEY=<your-production-key>

# OAuth
GOOGLE_CLIENT_ID=<production-client-id>
GOOGLE_CLIENT_SECRET=<production-client-secret>

# URLs
AUTH_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1

# Storage (use S3 in production)
STORAGE_BACKEND=s3
S3_BUCKET_NAME=<your-bucket>
S3_REGION=<your-region>
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>

# CORS
BACKEND_CORS_ORIGINS=https://yourdomain.com
```

2. **Security Checklist**
- [ ] Change AUTH_SECRET to a strong random value (32+ characters)
- [ ] Use managed PostgreSQL database (not Docker container)
- [ ] Enable SSL/TLS for all connections
- [ ] Set up firewall rules
- [ ] Enable database backups
- [ ] Use secrets management (AWS Secrets Manager, etc.)
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Enable HTTPS only
- [ ] Set up CDN for frontend assets

3. **Database Setup**
```bash
# Run migrations
docker compose exec backend alembic upgrade head

# Create initial admin user
docker compose exec backend python create_admin.py
```

4. **Monitoring**
- Set up health check monitoring for `/api/v1/health`
- Monitor `/api/v1/metrics` endpoint (requires superuser auth)
- Set up log aggregation (ELK, CloudWatch, etc.)
- Configure alerting for errors and performance issues

## Architecture

### Services

1. **Frontend (Next.js)**
   - Port: 3001 (host) → 3000 (container)
   - Built with Next.js 16.2
   - Server-side rendering
   - NextAuth for authentication

2. **Backend (FastAPI)**
   - Port: 8000
   - Python 3.12
   - Async SQLAlchemy
   - JWT authentication
   - Background tasks with Procrastinate

3. **Database (PostgreSQL + pgvector)**
   - Port: 5433 (host) → 5432 (container)
   - PostgreSQL 15 with pgvector extension
   - Persistent volume: postgres_data

### Network Communication

```
Browser → Frontend (3001) → Backend (8000) → Database (5432)
         ↓
    NEXT_PUBLIC_API_URL
    (http://localhost:8000/api/v1)

Frontend Container → Backend Container
         ↓
    INTERNAL_API_URL
    (http://backend:8000/api/v1)
```

## Scaling

### Horizontal Scaling

1. **Backend**
```yaml
# docker-compose.yml
backend:
  deploy:
    replicas: 3
  environment:
    WEB_CONCURRENCY: 2
```

2. **Frontend**
```yaml
frontend:
  deploy:
    replicas: 2
```

3. **Load Balancer**
- Use nginx or cloud load balancer
- Configure health checks
- Enable session affinity if needed

### Database Scaling
- Use read replicas for read-heavy workloads
- Configure connection pooling
- Monitor connection pool metrics at `/api/v1/metrics`

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker compose logs backend

# Common issues:
# 1. Database not ready - wait for health check
# 2. Environment variables missing - check .env
# 3. Port conflict - change POSTGRES_HOST_PORT
```

### Frontend can't connect to backend
```bash
# Check backend is running
curl http://localhost:8000/api/v1/health

# Check CORS configuration
# Ensure BACKEND_CORS_ORIGINS includes frontend URL

# Check browser console for errors
```

### Database connection issues
```bash
# Check database is running
docker compose ps database

# Test connection
docker compose exec database psql -U postgres -d master_foundation

# Reset database (WARNING: deletes data)
docker compose down -v
docker compose up -d
```

### Performance issues
```bash
# Check metrics
curl http://localhost:8000/api/v1/metrics

# Check slow queries
curl http://localhost:8000/api/v1/metrics/database/queries

# Check logs for slow requests (>1000ms)
docker compose logs backend | grep "Slow request"
```

## Backup and Recovery

### Database Backup
```bash
# Backup
docker compose exec database pg_dump -U postgres master_foundation > backup.sql

# Restore
docker compose exec -T database psql -U postgres master_foundation < backup.sql
```

### Volume Backup
```bash
# Backup volumes
docker run --rm -v template_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .

# Restore volumes
docker run --rm -v template_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data
```

## Maintenance

### Database Migrations
```bash
# Create new migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec backend alembic upgrade head

# Rollback one migration
docker compose exec backend alembic downgrade -1
```

### Updates
```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build

# Run migrations
docker compose exec backend alembic upgrade head
```
