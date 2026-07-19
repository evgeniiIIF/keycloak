import { Module } from '@nestjs/common';
import { SessionService } from './services/session.service';
import { TokenRefreshLock } from './services/token-refresh-lock.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [SessionService, TokenRefreshLock],
  exports: [SessionService, TokenRefreshLock],
})
export class SessionModule {}
