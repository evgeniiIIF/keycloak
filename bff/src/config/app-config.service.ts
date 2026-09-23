import { Injectable } from '@nestjs/common';

import { AppConfig, config } from './config';

// Типизированный сервис конфигурации.
// Инжектится через DI вместо глобального импорта config —
// держит SOLID-D и позволяет мокать конфиг в тестах.
@Injectable()
export class AppConfigService {
  private readonly value: AppConfig = config;

  get nodeEnv(): AppConfig['nodeEnv'] {
    return this.value.nodeEnv;
  }

  get isProduction(): AppConfig['isProduction'] {
    return this.value.isProduction;
  }

  get port(): AppConfig['port'] {
    return this.value.port;
  }

  get frontendUrl(): AppConfig['frontendUrl'] {
    return this.value.frontendUrl;
  }

  get protectedServiceUrl(): AppConfig['protectedServiceUrl'] {
    return this.value.protectedServiceUrl;
  }

  get corsOrigins(): AppConfig['corsOrigins'] {
    return this.value.corsOrigins;
  }

  get session(): AppConfig['session'] {
    return this.value.session;
  }

  get keycloak(): AppConfig['keycloak'] {
    return this.value.keycloak;
  }

  get redis(): AppConfig['redis'] {
    return this.value.redis;
  }

  get throttle(): AppConfig['throttle'] {
    return this.value.throttle;
  }
}
