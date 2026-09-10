import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';

import { RedisService } from '@/infra/redis/services/redis.service';
import { Public } from '@/modules/auth/decorators/auth.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private redis: RedisService,
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
  readiness() {
    if (!this.redis.client.isReady) {
      throw new ServiceUnavailableException('Redis is not available');   // 503
    }
    return { status: 'ok', redis: { status: 'up' } };
  }
}
