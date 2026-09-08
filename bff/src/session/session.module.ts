import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';
import { SessionService } from './services/session.service';
import { TokenRefreshLock } from './services/token-refresh-lock.service';

@Module({
  imports: [RedisModule],
  providers: [SessionService, TokenRefreshLock],
  exports: [SessionService, TokenRefreshLock],
})
export class SessionModule {}
