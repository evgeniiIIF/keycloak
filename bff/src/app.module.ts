import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from '@controllers/auth.controller';
import { ProtectedController } from '@controllers/protected.controller';
import { ProtectedServiceController } from '@controllers/protected_service.controller';
import { AuthService } from '@services/auth.service';
import { SessionService } from '@services/session.service';
import { ProxyService } from '@services/proxy.service';

@Module({
  imports: [HttpModule],
  controllers: [AuthController, ProtectedController, ProtectedServiceController],
  providers: [
    AuthService,
    SessionService,
    ProxyService,
  ],
})
export class AppModule {}
