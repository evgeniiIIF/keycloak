import { Module } from '@nestjs/common';

import { RedisModule } from '@/infra/redis/redis.module';

import { RedisThrottlerStorage } from './redis-throttler.storage';

// Инфраструктурный модуль для rate limiting.
// Предоставляет RedisThrottlerStorage и импортируется внутрь
// ThrottlerModule.forRootAsync — чтобы storage был виден в его DI-контексте.
@Module({
  imports: [RedisModule],
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlerInfraModule {}
