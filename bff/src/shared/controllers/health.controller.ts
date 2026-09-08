import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckResult, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';

import { Public } from '../../auth/decorators/auth.decorator';
import { RedisService } from '../../redis/services/redis.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('readiness')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.checkRedis()]);
  }

  private checkRedis(): Promise<HealthIndicatorResult> {
    return this.redis.client.ping()
      .then((pong) => ({ redis: { status: pong === 'PONG' ? 'up' as const : 'down' as const } }))
      .catch(() => ({ redis: { status: 'down' as const } }));
  }
}
