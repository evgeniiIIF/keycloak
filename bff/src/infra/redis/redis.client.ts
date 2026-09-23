import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

import { AppConfigService } from '@/config/app-config.service';
import { Logger } from '@/shared/logger/logger';

// Таймаут установки соединения с Redis при старте приложения
const REDIS_CONNECT_TIMEOUT_MS = 5000;

// Тонкая обёртка над клиентом Redis.
// Отвечает ТОЛЬКО за транспорт: подключение, отключение, атомарные операции.
// Никаких доменных ключей и бизнес-логики — это зона репозиториев.
@Injectable()
export class RedisClient implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType;

  constructor(private readonly config: AppConfigService) {
    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password,
      socket: config.redis.url.startsWith('rediss://') ? { tls: true } : undefined,
    });

    this.client.on('error', (err) => Logger.error('Redis', err.message));
  }

  // Подключаемся к Redis при старте приложения
  async onModuleInit() {
    try {
      await this.connectWithTimeout();                    // подключаемся или кидает ошибку
      Logger.info('Redis', 'Connected');                  // логируем успех
    } catch (err) {
      Logger.error('Redis', 'Failed to connect', { error: this.errorMessage(err) });
      throw err;                                          // падаем — NestJS не стартует
    }
  }

  // Отключаемся от Redis при остановке приложения
  async onModuleDestroy() {
    await this.client.disconnect();
  }

  // ── String ─────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.client.set(key, value, ttlSeconds ? { EX: ttlSeconds } : undefined);
  }

  // Атомарная установка с NX: пишем только если ключа нет.
  // Возвращает true, если запись сделана (мы владельцы), false — если ключ уже занят.
  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, { NX: true, EX: ttlSeconds });
    return result === 'OK';
  }

  async del(keys: string | string[]): Promise<void> {
    if (Array.isArray(keys) ? keys.length === 0 : !keys) return;   // ничего не удаляем, если ключей нет
    await this.client.del(keys);
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  // Атомарное обновление строки по Lua-скрипту.
  // Используется, когда нужна операция «прочитал-изменил-записал» без race condition.
  async eval<T>(script: string, keys: string[], args: string[]): Promise<T> {
    return this.client.eval(script, { keys, arguments: args }) as Promise<T>;
  }

  // ── Set ────────────────────────────────────────────────────────

  async sAdd(key: string, member: string): Promise<void> {
    await this.client.sAdd(key, member);
  }

  async sRem(key: string, member: string): Promise<void> {
    await this.client.sRem(key, member);
  }

  async sMembers(key: string): Promise<string[]> {
    return this.client.sMembers(key);
  }

  // ── Пайплайны ──────────────────────────────────────────────────

  // Выполнить несколько команд одной пачкой.
  // Возвращает true, если все команды прошли успешно.
  async pipeline(commands: PipelineCommand[]): Promise<void> {
    const multi = this.client.multi();
    for (const cmd of commands) this.applyPipelineCommand(multi, cmd);   // наполняем пайплайн
    await multi.exec();
  }

  // ── Test helpers ───────────────────────────────────────────────

  // Очистить всю базу. ТОЛЬКО для интеграционных тестов и локальной отладки.
  // В проде не вызывать — снесёт все сессии разом.
  async flushAll(): Promise<void> {
    await this.client.flushAll();
  }

  // ── Health ─────────────────────────────────────────────────────

  isReady(): boolean {
    return this.client.isReady;
  }

  // ── Примитивы ──────────────────────────────────────────────────

  // Подключаемся с таймаутом — если Redis не ответил за N мс, кидаем ошибку
  private async connectWithTimeout(): Promise<void> {
    await Promise.race([
      this.client.connect(),
      this.rejectAfter(REDIS_CONNECT_TIMEOUT_MS, 'Redis connect timeout'),
    ]);
  }

  // Промис, который реджектится через ms миллисекунд
  private rejectAfter(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
  }

  // Применяем одну команду пайплайна к multi-объекту
  private applyPipelineCommand(multi: ReturnType<RedisClientType['multi']>, cmd: PipelineCommand): void {
    if (cmd.type === 'sAdd') multi.sAdd(cmd.key, cmd.member);
    if (cmd.type === 'expire') multi.expire(cmd.key, cmd.ttlSeconds);
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

// Команды, поддерживаемые в пайплайне.
// Расширяется по мере необходимости — новый тип команды = новая ветка в applyPipelineCommand.
export type PipelineCommand =
  | { type: 'sAdd'; key: string; member: string }
  | { type: 'expire'; key: string; ttlSeconds: number };
