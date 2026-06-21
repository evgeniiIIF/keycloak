import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './configs/configuration';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  // Включаем отладку HTTP-запросов
  process.env.NODE_DEBUG = 'http';

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: 'http://localhost:8081',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(config.port);
  console.log(`BFF Application is running on: http://localhost:${config.port}`);
}

bootstrap();