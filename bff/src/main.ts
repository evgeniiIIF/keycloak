import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppModule } from './app.module';
import { config } from './config/config';
import { RedisService } from './services/redis.service';
import { CsrfMiddleware } from './middleware/csrf.middleware';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { Logger } from './shared/logger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const session = require('express-session');
import RedisStore from 'connect-redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const redis = app.get(RedisService);

  // Trust proxy (behind nginx)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security
  app.use(helmet());
  app.use(cookieParser());

  // Body parsers (urlencoded needed for Keycloak backchannel logout)
  app.use(express.urlencoded({ extended: true }));

  // Validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  // Global error handler
  app.useGlobalFilters(new HttpExceptionFilter());

  const isProd = config.nodeEnv === 'production';

  // Session with Redis store
  app.use(
    session({
      store: new RedisStore({ client: redis.client, prefix: config.session.prefix }),
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: config.session.ttl * 1000,
      },
    }),
  );

  // Double-submit CSRF: set XSRF-TOKEN cookie on first visit
  const csrf = app.get(CsrfMiddleware);
  app.use(csrf.use.bind(csrf));

  // CORS
  app.enableCors({
    origin: config.corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.info('App', `Running on http://localhost:${config.port}`);
}

bootstrap();
