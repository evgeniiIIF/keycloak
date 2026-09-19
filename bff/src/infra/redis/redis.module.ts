import { Global, Module } from '@nestjs/common';

import { RedisClient } from './redis.client';
import { RedisService } from './services/redis.service';

// Глобальный инфраструктурный модуль Redis.
// Отдаёт наружу RedisClient (новый транспорт) и RedisService (устаревший фасад).
// RedisService будет удалён после миграции всех потребителей на RedisClient.
@Global()
@Module({
  providers: [RedisClient, RedisService],
  exports: [RedisClient, RedisService],
})
export class RedisModule {}
