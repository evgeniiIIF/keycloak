import { Injectable, Scope } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export type LogField = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogField>;

// Тонкая обёртка над PinoLogger.
// Даёт наш API (info/warn/error с fields-объектом) и хранит context сервиса,
// чтобы не передавать его в каждом вызове.
//
// Использование:
//   constructor(private logger: AppLogger) {
//     this.logger.setContext('AuthService');
//   }
//   this.logger.info('Login complete', { user: 'testuser' });
//
// Маскировка PII/секретов — в конфиге pino (logger.module.ts, redact).
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger {
  private context = 'App';

  constructor(private readonly pino: PinoLogger) {}

  // Устанавливаем имя сервиса. Вызывается один раз в конструкторе сервиса.
  setContext(name: string): void {
    this.context = name;
    this.pino.setContext(name);
  }

  info(message: string, fields?: LogFields): void {
    this.pino.info(this.withContext(fields), message);
  }

  warn(message: string, fields?: LogFields): void {
    this.pino.warn(this.withContext(fields), message);
  }

  error(message: string, fields?: LogFields): void {
    this.pino.error(this.withContext(fields), message);
  }

  debug(message: string, fields?: LogFields): void {
    this.pino.debug(this.withContext(fields), message);
  }

  // ── Примитивы ──────────────────────────────────────────────────

  // Добавляем context в fields, чтобы pino его залогировал
  private withContext(fields?: LogFields): Record<string, unknown> {
    return { context: this.context, ...fields };
  }
}
