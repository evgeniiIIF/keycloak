import { Module } from '@nestjs/common';
import { AuthController } from '@controllers/auth.controller';
import { ProtectedController } from '@controllers/protected.controller';
import { ProtectedServiceController } from '@controllers/protected_service.controller';
import { AdminEventsController } from '@controllers/admin-events.controller';
import { AuthService } from '@services/auth.service';
import { SessionService } from '@services/session.service';
import { ProxyService } from '@services/proxy.service';
import { HttpService } from './http/http.service';

@Module({
  controllers: [AuthController, ProtectedController, ProtectedServiceController, AdminEventsController],
  providers: [
    HttpService,
    AuthService,
    SessionService,
    ProxyService,
  ],
})
export class AppModule {}
