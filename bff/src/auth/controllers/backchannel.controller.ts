import { Body,Controller, Header, Post } from '@nestjs/common';

import { Public } from '../decorators/auth.decorator';
import { BackchannelLogoutDto } from '../dto/backchannel-logout.dto';
import { BackchannelService } from '../services/backchannel.service';

@Public()
@Controller()
export class BackchannelController {
  constructor(private backchannelService: BackchannelService) {}

  @Post('api/auth/backchannel-logout')
  @Header('Cache-Control', 'no-store')
  async backchannelLogout(@Body() body: BackchannelLogoutDto) {
    await this.backchannelService.handleBackchannelLogout(body.logout_token);
  }
}
