import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './configs/configuration';
import * as cookieParser from 'cookie-parser';
import { Logger } from './utils/logger';

async function bootstrap() {
  process.env.NODE_DEBUG = 'http';

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: 'http://localhost:8082',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(config.port);
  Logger.info('App', `BFF Application is running on: http://localhost:${config.port}`);
}

bootstrap();
