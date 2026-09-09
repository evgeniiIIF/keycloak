import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder,SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { config } from './config/config';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { Logger } from './shared/logger/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configBuilder = new DocumentBuilder()
    .setTitle('Keycloak BFF API')
    .setDescription('API документация для BFF сервиса')
    .setVersion('1.0')
    .addCookieAuth('connect.sid');

  const document = SwaggerModule.createDocument(app, configBuilder.build());
  SwaggerModule.setup('api/docs', app, document);
  Logger.info('App', `Swagger UI on http://localhost:${config.port}/api/docs`);
  
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: config.corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.enableShutdownHooks();
  await app.listen(config.port);
  Logger.info('App', `Running on http://localhost:${config.port}`);
}

bootstrap();
