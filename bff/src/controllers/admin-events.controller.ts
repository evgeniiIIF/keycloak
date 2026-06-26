import { Controller, Post, Body } from '@nestjs/common';
import { SessionService } from '@services/session.service';
import { Logger } from '../utils/logger';

@Controller('api/auth')
export class AdminEventsController {
  constructor(private sessionService: SessionService) {}

  @Post('admin-events')
  async handleAdminEvent(@Body() event: any) {
    Logger.info('AdminEvents', `Admin event: ${event.resourceType} ${event.operationType}`);

    if (event.resourceType === 'USER_SESSION' && event.operationType === 'DELETE') {
      const userId = event.details?.user_id;
      if (userId) {
        Logger.info('AdminEvents', `Terminating sessions for user: ${userId}`);
        await this.sessionService.deleteSessionsByUser(userId);
      }
    }

    return { status: 'ok' };
  }
}
