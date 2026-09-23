import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import { AppConfigService } from '@/config/app-config.service';
import { HttpExceptionFilter } from '@/shared/filters/http-exception.filter';
import { Logger } from '@/shared/logger/logger';

import { AppModule } from './app.module';

// Точка входа BFF: собирает NestJS-приложение, настраивает middleware,
// поднимает HTTP-сервер. Все шаги явно перечислены в bootstrap.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);          // создаём приложение
  const config = app.get(AppConfigService);                 // достаём конфиг из DI
  configureApp(app, config);                                // middleware, pipes, filters, cors
  if (!config.isProduction) setupSwagger(app, config);      // swagger только вне прода
  await startServer(app, config);                           // слушаем порт
}

// Настраиваем глобальные middleware, pipes, filters и CORS.
function configureApp(app: INestApplication, config: AppConfigService): void {
  configureTrustProxy(app);                                 // trust proxy для X-Forwarded-*
  app.use(helmet());                                        // security headers
  app.use(cookieParser());                                  // cookies → req.cookies
  app.use(express.json());                                  // body parser json
  app.use(express.urlencoded({ extended: true }));          // body parser urlencoded
  configureValidation(app);                                 // глобальные pipe-ы
  configureCors(app, config);                               // CORS
  app.useGlobalFilters(new HttpExceptionFilter());          // единый формат ошибок
  app.enableShutdownHooks();                                // корректное завершение
}

// Доверяем первому прокси — чтобы req.ip и secure-cookies работали за nginx/ingress
function configureTrustProxy(app: INestApplication): void {
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
}

// Глобальная валидация DTO: whitelist отрезает лишние поля, forbid — запрещает их вовсе
function configureValidation(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}

// CORS с credentials — куки уходят на фронт, origin строго из конфига
function configureCors(app: INestApplication, config: AppConfigService): void {
  app.enableCors({
    origin: config.corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
}

// Swagger UI доступен только вне production, чтобы не отдавать схему API публично.
function setupSwagger(app: INestApplication, config: AppConfigService): void {
  const configBuilder = new DocumentBuilder()
    .setTitle('Keycloak BFF API')
    .setDescription('API документация для BFF сервиса')
    .setVersion('1.0')
    .addCookieAuth('connect.sid');

  const document = SwaggerModule.createDocument(app, configBuilder.build());
  SwaggerModule.setup('api/docs', app, document);
  Logger.info('App', `Swagger UI on http://localhost:${config.port}/api/docs`);
}

// Запускаем HTTP-сервер и логируем адрес
async function startServer(app: INestApplication, config: AppConfigService): Promise<void> {
  await app.listen(config.port);
  Logger.info('App', `Running on http://localhost:${config.port}`);
}

void bootstrap();
