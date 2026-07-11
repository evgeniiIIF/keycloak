import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult, HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '../services/redis.service';
import { Public } from '../decorators/auth.decorator';

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
