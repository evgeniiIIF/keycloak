import { Controller, Post, Header, Body } from '@nestjs/common';
import { Public } from '../decorators/auth.decorator';
import { BackchannelService } from '../services/backchannel.service';
import { BackchannelLogoutDto } from '../dto/backchannel-logout.dto';

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
