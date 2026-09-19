import { Injectable } from '@nestjs/common';

import { config } from '@/config/config';
import { RedisClient } from '@/infra/redis/redis.client';
import { RedisKeys } from '@/infra/redis/redis.keys';
import { Session } from '@/modules/auth/types/session';

// Lua-скрипт атомарного обновления токенов.
// Читает сессию, заменяет поле tokens, сохраняет обратно с сохранением TTL.
// Защищает от race condition при параллельных refresh.
const UPDATE_TOKENS_LUA = `
local raw = redis.call('get', KEYS[1])
if not raw then return 0 end
local session = cjson.decode(raw)
session.tokens = cjson.decode(ARGV[1])
redis.call('set', KEYS[1], cjson.encode(session), 'KEEPTTL')
return 1
`;

// Хранилище сессий BFF в Redis.
// Только чтение/запись/удаление сессии — вся бизнес-логика в SessionService.
@Injectable()
export class SessionRepository {
  constructor(private readonly redis: RedisClient) {}

  // Сохраняем сессию целиком с TTL из конфига
  async save(session: Session): Promise<void> {
    const key = RedisKeys.session(session.id);
    await this.redis.set(key, JSON.stringify(session), config.session.ttl);
  }

  // Достаём сессию по id или null, если её нет или JSON повреждён
  async find(id: string): Promise<Session | null> {
    const key = RedisKeys.session(id);
    const raw = await this.redis.get(key);
    return this.parse(raw);
  }

  // Атомарно обновляем только токены (сохраняя TTL и остальные поля).
  // Возвращаем false, если сессия исчезла между чтением и записью.
  async updateTokens(id: string, tokens: Session['tokens']): Promise<boolean> {
    const key = RedisKeys.session(id);
    const result = await this.redis.eval<number>(
      UPDATE_TOKENS_LUA,
      [key],
      [JSON.stringify(tokens)],
    );
    return result === 1;
  }

  // Продлеваем TTL сессии (sliding expiration при активности пользователя)
  async touch(id: string): Promise<void> {
    const key = RedisKeys.session(id);
    await this.redis.expire(key, config.session.ttl);
  }

  // Удаляем сессию из хранилища
  async delete(id: string): Promise<void> {
    const key = RedisKeys.session(id);
    await this.redis.del(key);
  }

  // ── Примитивы ──────────────────────────────────────────────────

  // Парсим строку из Redis в Session или возвращаем null
  private parse(raw: string | null): Session | null {
    if (!raw) return null;                        // сессии нет
    try {
      return JSON.parse(raw) as Session;          // парсим JSON
    } catch {
      return null;                                // битый JSON — считаем сессию отсутствующей
    }
  }
}
