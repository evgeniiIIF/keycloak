import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { SessionModule } from '@/modules/auth/sessions/session.module';

import { GatewayController } from './controllers/gateway.controller';
import { AxiosHttpClient } from './services/axios-http-client.service';
import { HttpClient } from './services/http-client.service';

@Module({
  imports: [AuthModule, SessionModule],
  controllers: [GatewayController],
  providers: [HttpClient, AxiosHttpClient],
  exports: [HttpClient],
})
export class GatewayModule {}
