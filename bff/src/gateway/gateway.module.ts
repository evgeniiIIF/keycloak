import { Module } from '@nestjs/common';
import { GatewayController } from './controllers/gateway.controller';
import { HttpClient } from './services/http-client.service';
import { AxiosHttpClient } from './services/axios-http-client.service';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [AuthModule, SessionModule],
  controllers: [GatewayController],
  providers: [HttpClient, AxiosHttpClient],
  exports: [HttpClient],
})
export class GatewayModule {}
