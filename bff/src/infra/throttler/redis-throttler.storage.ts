import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

import { RedisClient } from '@/infra/redis/redis.client';

// Lua-скрипт инкремента счётчика и блокировки при превышении лимита.
// Всё атомарно — при параллельных запросах не будет двойного инкремента.
//
// KEYS[1] — ключ счётчика
// KEYS[2] — ключ блокировки
// ARGV[1] — ttl счётчика, сек
// ARGV[2] — limit
// ARGV[3] — blockDuration, сек
const INCREMENT_LUA = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end

local ttl = redis.call('TTL', KEYS[1])
local limit = tonumber(ARGV[2])
local isBlocked = 0
local blockTtl = 0

if hits > limit then
  local existing = redis.call('TTL', KEYS[2])
  if existing < 0 then
    redis.call('SET', KEYS[2], '1', 'EX', ARGV[3])
    blockTtl = tonumber(ARGV[3])
  else
    blockTtl = existing
  end
  isBlocked = 1
end

return { hits, ttl, isBlocked, blockTtl }
`;

// Хранилище счётчиков rate limit в Redis.
// Позволяет нескольким инстансам BFF делить единые счётчики — критично
// при горизонтальном масштабировании.
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisClient) {}

  // Инкрементировать счётчик и, если превышен лимит, выставить блокировку.
  // Возвращает текущее состояние: hits, TTL, признак блокировки.
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = this.hitKey(throttlerName, key);
    const blockKey = this.blockKey(throttlerName, key);

    const result = await this.redis.eval<number[]>(
      INCREMENT_LUA,
      [hitKey, blockKey],
      [String(this.toSeconds(ttl)), String(limit), String(this.toSeconds(blockDuration))],
    );

    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = result;
    return {
      totalHits,
      timeToExpire,
      isBlocked: isBlocked === 1,
      timeToBlockExpire,
    };
  }

  // ── Примитивы ──────────────────────────────────────────────────

  private hitKey(name: string, key: string): string {
    return `throttle:${name}:hits:${key}`;
  }

  private blockKey(name: string, key: string): string {
    return `throttle:${name}:block:${key}`;
  }

  // Throttler передаёт ttl и blockDuration в миллисекундах — Redis ждёт секунды
  private toSeconds(ms: number): number {
    return Math.ceil(ms / 1000);
  }
}
