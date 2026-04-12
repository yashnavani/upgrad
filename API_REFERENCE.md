# API Reference

Base URL: `http://localhost:8000/api/v1`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Get Token

**POST** `/auth/login`

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=yourpassword"
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

## System Endpoints

### Health Check

**GET** `/health`

Check basic system health.

```bash
curl http://localhost:8000/api/v1/health
```

Response:
```json
{
  "status": "online",
  "environment": "development",
  "project": "Master Foundation",
  "database": "healthy",
  "version": "0.1.0"
}
```

### Detailed Health Check

**GET** `/health/detailed`

Get detailed health information for all dependencies.

```bash
curl http://localhost:8000/api/v1/health/detailed
```

Response:
```json
{
  "status": "healthy",
  "environment": "development",
  "project": "Master Foundation",
  "checks": {
    "database": {
      "healthy": true,
      "message": "Database connected",
      "version": "PostgreSQL 15.x"
    },
    "gemini_api": {
      "healthy": true,
      "message": "Gemini API configured"
    },
    "storage": {
      "healthy": true,
      "message": "Local storage configured at data/uploads"
    }
  }
}
```

### System Metrics (Requires Superuser)

**GET** `/metrics`

Get system and database metrics.

```bash
curl http://localhost:8000/api/v1/metrics \
  -H "Authorization: Bearer <superuser-token>"
```

Response:
```json
{
  "system": {
    "timestamp": "2026-04-12T10:30:00",
    "cpu_percent": 25.5,
    "memory_percent": 45.2,
    "memory_available_mb": 8192.5,
    "disk_usage_percent": 60.0,
    "python_version": "3.12.0",
    "uptime_seconds": 3600.5
  },
  "database": {
    "pool_size": 5,
    "checked_in": 3,
    "checked_out": 2,
    "overflow": 0,
    "total_connections": 5
  }
}
```

## Authentication Endpoints

### Register

**POST** `/auth/register`

Create a new user account.

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "full_name": "John Doe"
  }'
```

### Login

**POST** `/auth/login`

Login with email and password.

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=securepassword123"
```

### Google OAuth Token

**POST** `/auth/google-token`

Get JWT token for Google OAuth user.

```bash
curl -X POST http://localhost:8000/api/v1/auth/google-token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "google_id": "google-user-id"
  }'
```

## User Management

### Get Current User

**GET** `/users/me`

Get current authenticated user information.

```bash
curl http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <token>"
```

### List Users (Admin Only)

**GET** `/users`

List all users (requires admin privileges).

```bash
curl http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer <admin-token>"
```

## AI Endpoints

### Chat with AI

**POST** `/ai/chat`

Send a message to the AI cognitive router.

```bash
curl -X POST http://localhost:8000/api/v1/ai/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the status of my recent decisions?",
    "context": {}
  }'
```

### AI Insights

**GET** `/ai/insights`

Get AI-generated insights.

```bash
curl http://localhost:8000/api/v1/ai/insights \
  -H "Authorization: Bearer <token>"
```

## Decision Management

### List Decisions

**GET** `/decisions`

Get all decisions with optional filtering.

```bash
curl http://localhost:8000/api/v1/decisions?status=pending&limit=10 \
  -H "Authorization: Bearer <token>"
```

### Create Decision

**POST** `/decisions`

Create a new decision for human-in-the-loop review.

```bash
curl -X POST http://localhost:8000/api/v1/decisions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Approve new feature",
    "description": "Should we implement feature X?",
    "options": ["approve", "reject", "defer"],
    "metadata": {}
  }'
```

### Update Decision

**PATCH** `/decisions/{decision_id}`

Update a decision status.

```bash
curl -X PATCH http://localhost:8000/api/v1/decisions/123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "notes": "Approved after review"
  }'
```

## Policy Management

### List Policies

**GET** `/policies`

Get all AI policies.

```bash
curl http://localhost:8000/api/v1/policies \
  -H "Authorization: Bearer <token>"
```

### Create Policy

**POST** `/policies`

Create a new AI policy.

```bash
curl -X POST http://localhost:8000/api/v1/policies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Data Privacy Policy",
    "description": "Guidelines for handling user data",
    "rules": ["Never share PII", "Encrypt at rest"],
    "priority": 1
  }'
```

## File Management

### Upload File

**POST** `/files/upload`

Upload a file.

```bash
curl -X POST http://localhost:8000/api/v1/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/file.pdf"
```

### Download File

**GET** `/files/{file_id}/download`

Download a file.

```bash
curl http://localhost:8000/api/v1/files/123/download \
  -H "Authorization: Bearer <token>" \
  -o downloaded_file.pdf
```

## Real-Time WebSocket

### Connect to WebSocket

**WS** `/realtime/ws`

Connect to real-time updates via WebSocket.

```javascript
const ws = new WebSocket('ws://localhost:8000/api/v1/realtime/ws?token=<jwt-token>');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'decisions'
}));
```

## Audit Logs

### List Audit Logs

**GET** `/audit-logs`

Get audit logs with filtering.

```bash
curl "http://localhost:8000/api/v1/audit-logs?user_id=123&limit=50" \
  -H "Authorization: Bearer <token>"
```

## Dashboard

### Get Dashboard Stats

**GET** `/dashboard/stats`

Get dashboard statistics.

```bash
curl http://localhost:8000/api/v1/dashboard/stats \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "total_decisions": 150,
  "pending_decisions": 25,
  "approved_decisions": 100,
  "rejected_decisions": 25,
  "total_policies": 10,
  "active_users": 50
}
```

## Response Headers

All responses include these headers:

- `X-Request-ID`: Unique request identifier for tracing
- `X-Process-Time`: Request processing time in milliseconds
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY
- `X-XSS-Protection`: 1; mode=block

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message here",
  "errors": [
    {
      "loc": ["body", "field_name"],
      "msg": "Field is required",
      "type": "value_error.missing"
    }
  ]
}
```

### Common Status Codes

- `200 OK`: Success
- `201 Created`: Resource created
- `204 No Content`: Success with no response body
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Rate Limiting

Production environment enforces rate limiting:
- 60 requests per minute per IP
- Rate limit info in response headers (coming soon)

## API Versioning

Current version: `v1`

The API version is included in the URL path: `/api/v1/...`

Future versions will be available at `/api/v2/...` with deprecation notices.
