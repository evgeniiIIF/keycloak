# Docker Compose Build & Verify

## Description

Rebuild Docker containers after code changes and verify all services start correctly. Use this after any edit to bff/, client/, protected-service/, or docker-compose.yml.

## When to Use

- After editing backend (bff) or frontend (client) source code
- After changing docker-compose.yml, Dockerfiles, or .env
- After adding/removing services
- When diagnosing startup failures

## Procedure

### 1. Identify changed service

```bash
git diff --name-only HEAD~1 2>/dev/null || git status --short
```

Determine which service directories were modified: `bff/`, `client/`, `protected-service/`.

### 2. Rebuild only affected services

```bash
# Full rebuild (all services)
docker compose up -d --build

# Single service rebuild (faster)
docker compose up -d --build bff
docker compose up -d --build frontend
docker compose up -d --build protected-service
```

### 3. Wait and verify startup

```bash
# Wait 10-15 seconds for services to initialize
sleep 15

# Check all containers are running
docker compose ps

# Check for startup errors
docker compose logs --tail=30 bff
docker compose logs --tail=30 frontend
docker compose logs --tail=30 protected-service
docker compose logs --tail=30 keycloak
docker compose logs --tail=30 redis
```

### 4. Verify health

```bash
# BFF should respond
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/

# Keycloak should be accessible
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/

# Redis should be reachable
docker compose exec redis redis-cli ping
```

### 5. If errors found

```bash
# Full logs for debugging
docker compose logs bff --tail=100

# Rebuild with no cache if dependency issues
docker compose up -d --build --no-cache bff
```

## Stopping

```bash
docker compose down          # stop and remove containers
docker compose down -v       # stop, remove containers AND volumes (full reset)
```
