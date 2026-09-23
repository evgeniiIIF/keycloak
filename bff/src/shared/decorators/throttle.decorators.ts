import { Throttle } from '@nestjs/throttler';

import { config } from '@/config/config';

// Строгий rate limit для чувствительных эндпоинтов (login, callback, logout,
// backchannel-logout). Обёртка над @Throttle — читает лимиты из конфига,
// чтобы не дублировать одну и ту же длинную строку в каждом контроллере.
export const StrictThrottle = (): MethodDecorator & ClassDecorator =>
  Throttle({
    strict: {
      limit: config.throttle.strictLimit,
      ttl: config.throttle.ttlSeconds * 1000,
    },
  });
