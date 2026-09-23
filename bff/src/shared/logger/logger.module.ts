import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { AppConfigService } from '@/config/app-config.service';
import { AppConfigModule } from '@/config/config.module';

import { AppLogger } from './app-logger.service';

// Глобальный модуль логгера.
// - PinoLoggerModule.forRootAsync — настраивает транспорт pino (dev: pretty, prod: JSON)
// - AppLogger — наш тонкий wrapper, доступен везде через DI
@Global()
@Module({
  imports: [
    AppConfigModule,
    PinoLoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.isProduction ? 'info' : 'debug',
          transport: config.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
              'password',
              'email',
              'preferred_username',
              'accessToken',
              'refreshToken',
              'idToken',
              'client_secret',
              'code',
              'state',
              '*.password',
              '*.email',
              '*.accessToken',
              '*.refreshToken',
              '*.idToken',
            ],
            censor: '***',
          },
          autoLogging: {
            ignore: (req) => req.url?.startsWith('/health') ?? false,
          },
          customSuccessMessage: (req, res) =>
            `${req.method} ${req.url} → ${res.statusCode}`,
          customErrorMessage: (req, res) =>
            `${req.method} ${req.url} → ${res.statusCode} (error)`,
        },
      }),
    }),
  ],
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}
