import { Body, Controller, Header, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../decorators/auth.decorator';
import { BackchannelLogoutDto } from '../dto/backchannel-logout.dto';
import { BackchannelService } from '../services/backchannel.service';

@ApiTags('backchannel')
@Public()
@Controller()
export class BackchannelController {
  constructor(private backchannelService: BackchannelService) {}

  @Post('api/auth/backchannel-logout')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Обработать backchannel logout от Keycloak' })
  @ApiResponse({ status: 200, description: 'Все сессии пользователя удалены' })
  @ApiResponse({ status: 400, description: 'Невалидный logout token или отсутствует sub' })
  @ApiResponse({ status: 401, description: 'Невалидная подпись токена или replay detected' })
  async backchannelLogout(@Body() body: BackchannelLogoutDto) {
    await this.backchannelService.handleBackchannelLogout(body.logout_token);
  }
}
