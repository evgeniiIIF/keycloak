import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus';

import { RedisClient } from '@/infra/redis/redis.client';
import { Public } from '@/modules/auth/decorators/auth.decorator';

// Health-эндпоинты для liveness/readiness проб.
// Публичные — используются оркестратором (k8s, docker healthcheck) без аутентификации.
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redis: RedisClient,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe — приложение живо' })
  @ApiResponse({ status: 200, description: 'Приложение работает' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe — проверка подключения к Redis' })
  @ApiResponse({ status: 200, description: 'Redis доступен' })
  @ApiResponse({ status: 503, description: 'Redis недоступен' })
  readiness(): RedisReadiness {
    if (!this.redis.isReady()) {
      throw new ServiceUnavailableException('Redis is not available');
    }
    return { status: 'ok', redis: { status: 'up' } };
  }
}

// Ответ readiness-пробы
export interface RedisReadiness {
  status: 'ok';
  redis: { status: 'up' };
}
