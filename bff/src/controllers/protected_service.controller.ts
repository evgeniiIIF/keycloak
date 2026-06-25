
import { Controller, Get, Post, Req, Res, UseGuards, Param } from '@nestjs/common';
import { Response, Request } from 'express';
import { SessionGuard } from '@guards/session.guard';
import { CsrfGuard } from '@guards/csrf.guard';
import { ProxyService } from '@services/proxy.service';
import { config } from '@configs/configuration';

@Controller('api/service')
export class ProtectedServiceController {
  constructor(private proxyService: ProxyService) {}

  @Get()
  @UseGuards(SessionGuard)
  async proxyGetRoot(@Req() req: any, @Res() res: Response) {
    return this.proxyGet('', req, res);
  }

  @Get('*')
  @UseGuards(SessionGuard)
  async proxyGet(@Param('0') path: string, @Req() req: any, @Res() res: Response) {
    const sessionId = req.cookies?.SESSION_ID;
    const targetUrl = `${config.protectedServiceUrl}/${path}`;

    try {
      const response = await this.proxyService.proxyRequest(sessionId, targetUrl, 'GET');
      res.set('Content-Type', response.headers['content-type'] as string);
      res.status(response.status).send(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).send(error.response?.data || 'Proxy Error');
    }
  }

  @Post('*')
  @UseGuards(SessionGuard, CsrfGuard)
  async proxyPost(@Param('0') path: string, @Req() req: any, @Res() res: Response) {
    const sessionId = req.cookies?.SESSION_ID;
    const targetUrl = `${config.protectedServiceUrl}/${path}`;

    try {
      const response = await this.proxyService.proxyRequest(
        sessionId,
        targetUrl,
        'POST',
        req.body
      );
      res.set('Content-Type', response.headers['content-type'] as string);
      res.status(response.status).send(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).send(error.response?.data || 'Proxy Error');
    }
  }
}
