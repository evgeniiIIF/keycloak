# Plan: Разделение docker-compose на dev и prod

## Текущее состояние

`docker-compose.yml` содержит dev и prod сервисы через Docker Compose profiles. Prod-сервисы (`-prod` суффикс) активируются через `COMPOSE_PROFILES=prod`.

## Что делаем

### 1. Упрощаем `docker-compose.yml` (только dev)

Удаляем:
- `frontend-prod` (строки 112-124)
- `bff-prod` (строки 126-154)
- `protected-service-prod` (строки 156-170)

Оставляем без изменений: postgres, keycloak, redis, bff, protected-service, frontend.

### 2. Создаём `docker-compose.prod.yml`

**Инфраструктура:**
- `postgres` — как в dev, но без暴露 порта 5432 (только внутренняя сеть)
- `keycloak` — режим `start` (prod), volume `./themes` остаётся, `KC_HOSTNAME` из `.env`
- `redis` — без暴露 порта 6379 (только внутренняя сеть)

**Приложения:**
- `bff` — `Dockerfile` (multi-stage), без volume mount, `NODE_ENV: production`, нет `extra_hosts`
- `protected-service` — `Dockerfile`, без volume mount
- `frontend` — `Dockerfile`, без volume mount, порт `80:80` (nginx)

**Networks & volumes:**
- `keycloak-network` — bridge (external, чтобы не конфликтовать с dev)
- `postgres_data` — именованный volume

### 3. Обновляем `.env`

Добавляем:
```
# Production
KC_HOSTNAME=localhost
```

## Ключевые отличия Dev vs Prod

| Параметр | Dev | Prod |
|---|---|---|
| Keycloak | `start-dev` | `start` |
| Keycloak themes | volume mount | volume mount (тот же) |
| BFF/Services | `Dockerfile.dev` + volumes | `Dockerfile` без volumes |
| NODE_ENV | `development` | `production` |
| Порты | Все暴露 | Только приложение (3000, 8080, 8082) |
| DB/Redis порты |暴露 для отладки | Только внутренние |

## Использование

```bash
# Dev (по умолчанию)
docker compose up --build

# Production
docker compose -f docker-compose.prod.yml up --build -d
```

## Файлы

1. `docker-compose.yml` — убрать prod сервисы
2. `docker-compose.prod.yml` — новый файл
3. `.env` — добавить KC_HOSTNAME

## Верификация

1. `docker compose up --build` — dev работает как раньше
2. `docker compose -f docker-compose.prod.yml config` — валидация
3. `docker compose -f docker-compose.prod.yml up --build -d` — prod стартует
