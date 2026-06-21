import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from '@controllers/auth.controller';
import { ProtectedController } from '@controllers/protected.controller';
import { AuthService } from '@services/auth.service';
import { SessionService } from '@services/session.service';

@Module({
  imports: [HttpModule],
  controllers: [AuthController, ProtectedController],
  providers: [
    AuthService,
    SessionService,
  ],
})
export class AppModule {}
