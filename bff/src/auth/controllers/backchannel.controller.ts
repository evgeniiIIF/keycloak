import { Controller, Post, Req, Header } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../decorators/auth.decorator';
import { BackchannelService } from '../services/backchannel.service';

@Public()
@Controller()
export class BackchannelController {
  constructor(private backchannelService: BackchannelService) {}

  // Извлекаем токен из запроса → передаём в сервис для обработки
  @Post('api/auth/backchannel-logout')
  @Header('Cache-Control', 'no-store')
  async backchannelLogout(@Req() req: Request) {
    await this.backchannelService.handleBackchannelLogout(req.body?.logout_token);
  }
}
