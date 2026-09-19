import { Global, Module } from '@nestjs/common';

import { RedisClient } from './redis.client';

// Глобальный инфраструктурный модуль Redis.
// Отдаёт наружу только тонкий RedisClient — доменные репозитории
// живут в своих модулях и внедряют его через DI.
@Global()
@Module({
  providers: [RedisClient],
  exports: [RedisClient],
})
export class RedisModule {}
