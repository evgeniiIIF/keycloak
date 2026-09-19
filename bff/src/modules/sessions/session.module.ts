import { Module } from '@nestjs/common';

import { RedisModule } from '@/infra/redis/redis.module';

import { SessionRepository } from './repositories/session.repository';
import { UserSessionsRepository } from './repositories/user-sessions.repository';
import { SessionService } from './services/session.service';
import { TokenRefreshLock } from './services/token-refresh-lock.service';

// Домен «сессии»: хранение, индекс по пользователю, distributed lock на refresh.
// Наружу отдаёт сервис сессий и lock — всё остальное (репозитории) приватно модулю.
@Module({
  imports: [RedisModule],
  providers: [
    SessionRepository,
    UserSessionsRepository,
    SessionService,
    TokenRefreshLock,
  ],
  exports: [SessionService, TokenRefreshLock],
})
export class SessionModule {}
