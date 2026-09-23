import { Global, Module } from '@nestjs/common';

import { AppConfigService } from './app-config.service';

// Глобальный модуль конфигурации.
// Делает AppConfigService доступным в DI без явного импорта в каждом модуле.
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
