# Quick Start Guide

Get your Master Foundation application running in 5 minutes!

## Prerequisites

- Docker Desktop installed and running
- Git (optional, for cloning)

## Step 1: Start Services

### Windows (PowerShell)
```powershell
.\scripts\dev.ps1 start
```

### Linux/Mac
```bash
chmod +x scripts/dev.sh
./scripts/dev.sh start
```

### Or use Docker Compose directly
```bash
docker compose up -d
```

## Step 2: Wait for Services

The script will automatically check health. If running manually, wait about 30 seconds for all services to be ready.

## Step 3: Verify Everything is Running

```bash
# Check container status
docker compose ps

# Check backend health
curl http://localhost:8000/api/v1/health

# Check frontend
# Open browser: http://localhost:3001
```

## Step 4: Access the Application

### Frontend
- URL: http://localhost:3001
- Login page: http://localhost:3001/login

### Backend API
- Base URL: http://localhost:8000/api/v1
- API Docs: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

### Database
- Host: localhost
- Port: 5433
- User: postgres
- Password: postgres_password
- Database: master_foundation

## Step 5: Create Admin User (Optional)

```bash
docker compose exec backend python create_admin.py
```

Follow the prompts to create an admin account.

## Common Tasks

### View Logs
```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only
docker compose logs -f frontend
```

### Run Database Migrations
```bash
docker compose exec backend alembic upgrade head
```

### Run Tests
```bash
docker compose exec backend pytest
```

### Stop Services
```bash
docker compose down
```

### Rebuild After Code Changes
```bash
docker compose up -d --build
```

## Troubleshooting

### Services Won't Start

**Check Docker is running:**
```bash
docker ps
```

**Check logs for errors:**
```bash
docker compose logs backend
docker compose logs frontend
docker compose logs database
```

**Common issues:**
- Port conflicts (8000, 3001, 5433 already in use)
- Docker Desktop not running
- Insufficient memory allocated to Docker

### Backend Returns 500 Errors

**Check database is ready:**
```bash
docker compose exec database psql -U postgres -d master_foundation -c "SELECT 1;"
```

**Run migrations:**
```bash
docker compose exec backend alembic upgrade head
```

### Frontend Can't Connect to Backend

**Check backend is running:**
```bash
curl http://localhost:8000/api/v1/health
```

**Check CORS configuration in .env:**
```
BACKEND_CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
```

**Check browser console for errors**

### Database Connection Failed

**Reset database (WARNING: deletes all data):**
```bash
docker compose down -v
docker compose up -d
```

**Wait for database to initialize (check logs):**
```bash
docker compose logs database
```

## Next Steps

1. **Read the Documentation**
   - [API Reference](API_REFERENCE.md)
   - [Deployment Guide](DEPLOYMENT.md)
   - [Improvements Summary](IMPROVEMENTS_SUMMARY.md)

2. **Explore the API**
   - Visit http://localhost:8000/api/v1/docs
   - Try the interactive API documentation

3. **Configure OAuth (Optional)**
   - Set up Google OAuth credentials
   - Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env

4. **Configure AI Features**
   - Get a Gemini API key
   - Update GEMINI_API_KEY in .env

5. **Customize**
   - Modify frontend components in `frontend/src/`
   - Add backend endpoints in `backend/app/api/v1/endpoints/`
   - Update database models in `backend/app/models/`

## Development Workflow

1. **Make code changes**
2. **Rebuild services:**
   ```bash
   docker compose up -d --build
   ```
3. **Run tests:**
   ```bash
   docker compose exec backend pytest
   ```
4. **Check health:**
   ```bash
   curl http://localhost:8000/api/v1/health/detailed
   ```
5. **View logs for errors:**
   ```bash
   docker compose logs -f
   ```

## Useful Commands

```bash
# Check service health
curl http://localhost:8000/api/v1/health/detailed | jq

# Get system metrics (requires admin token)
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/metrics | jq

# Open backend shell
docker compose exec backend bash

# Open database shell
docker compose exec database psql -U postgres -d master_foundation

# View real-time logs
docker compose logs -f --tail=100

# Restart a specific service
docker compose restart backend

# Check container resource usage
docker stats
```

## Getting Help

1. **Check logs:** `docker compose logs -f`
2. **Check health:** `curl http://localhost:8000/api/v1/health/detailed`
3. **Review documentation:** See DEPLOYMENT.md and API_REFERENCE.md
4. **Check environment:** Verify .env file has correct values

## Clean Slate (Reset Everything)

If you want to start fresh:

```bash
# Stop and remove everything (INCLUDING DATA)
docker compose down -v

# Start fresh
docker compose up -d

# Wait for services to be ready
sleep 30

# Run migrations
docker compose exec backend alembic upgrade head

# Create admin user
docker compose exec backend python create_admin.py
```

## Success Indicators

✅ All containers running: `docker compose ps` shows all services "Up"
✅ Backend healthy: `curl http://localhost:8000/api/v1/health` returns `{"status":"online"}`
✅ Frontend accessible: http://localhost:3001 loads
✅ Database connected: Health check shows `"database":"healthy"`
✅ API docs available: http://localhost:8000/api/v1/docs loads

---

**You're all set!** 🚀

The application is now running and ready for development.
