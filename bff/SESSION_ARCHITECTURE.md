# Архитектура сессий

## Где хранится сессия

### 1. Кука на клиенте (`connect.sid`)
- Содержит **только ID сессии** (не данные)
- Имя: `connect.sid`
- Настройки: `httpOnly: true`, `secure: true` (prod), `sameSite: 'lax'`

### 2. Данные сессии в Redis (автоматически)
- Ключ: `sess:<sessionId>`
- Хранит: `connect-redis` автоматически при вызове `session.save()`
- Содержит: `{ accessToken, refreshToken, idToken, userInfo, oauth }`

```typescript
// src/main.ts:43-56 — единственная необходимая настройка
session({
  store: new RedisStore({ client: redis.client, prefix: config.session.prefix }),
  secret: config.session.secret,
  // ...
})
```

`connect-redis` сериализует весь объект сессии в JSON и кладёт в Redis. Ручной код не нужен.

### 3. Индекс сессий пользователя в Redis (вручную)
- Ключ: `user_sessions:<userId>` (Redis Set)
- Хранит: `RedisService.addUserSession()`
- Содержит: список session ID для пользователя

```typescript
// src/services/redis.service.ts:30-32
async addUserSession(userId: string, sessionId: string): Promise<void> {
  await this.client.sAdd(`${USER_SESSIONS_PREFIX}:${userId}`, sessionId);
}
```

Это наш код — нужен для массового logout (удалить все сессии пользователя).

## Поток данных

```
1. GET /login
   → express-session генерирует session.id
   → кука connect.sid=sid123 отправляется клиенту

2. GET /callback?code=...
   → session.regenerate() (новый session.id)
   → session.accessToken = "eyJ..."
   → session.refreshToken = "eyJ..."
   → session.userInfo = { sub: "user-123", ... }
   → session.save() ← connect-redis кладёт всё в Redis: sess:sid123 = {...}
   → RedisService.addUserSession("user-123", "sid123") ← добавляет в user_sessions:user-123

3. GET /api/me
   → кука connect.sid=sid123
   → express-session достаёт sess:sid123 из Redis
   → req.session.accessToken, req.session.userInfo доступны

4. POST /logout
   → RedisService.removeUserSession("user-123", "sid123") ← удаляет из индекса
   → session.destroy() ← express-session удаляет sess:sid123 из Redis
```

## Итого

| Что | Кто хранит | Ключ в Redis | Значение |
|-----|-----------|--------------|----------|
| Данные сессии (токены, пользователь) | `connect-redis` (автоматически) | `sess:<sessionId>` | JSON со всеми полями сессии |
| Индекс сессий пользователя | `RedisService` (вручную) | `user_sessions:<userId>` | Set с session ID |

- **`connect-redis`** — хранит данные сессии автоматически
- **`RedisService`** — управляет индексом (какие сессии у пользователя) для массовых операций
