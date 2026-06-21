import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SessionGuard } from '@guards/session.guard';
import { CsrfGuard } from '@guards/csrf.guard';

@Controller('api/hello')
export class ProtectedController {

  @Get()
  @UseGuards(SessionGuard)
  async helloGet(@Req() req: any) {
    return {
      message: 'Hello World! (GET request successful)',
      user: req.userSession.userInfo
    };
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard)
  async helloPost(@Body() body: any, @Req() req: any) {
    return {
      message: 'Hello World! (POST request successful - CSRF verified)',
      user: req.userSession.userInfo,
      receivedData: body
    };
  }
}
