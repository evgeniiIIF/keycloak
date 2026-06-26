
import { Controller, Get, Post, Req, Res, UseGuards, Param } from '@nestjs/common';
import { Response } from 'express';
import { SessionGuard } from '@guards/session.guard';
import { CsrfGuard } from '@guards/csrf.guard';
import { httpService } from '../http/httpService';
import { config } from '@configs/configuration';
import { Logger } from '../utils/logger';

@Controller('api/service')
export class ProtectedServiceController {
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

    Logger.debug('RequestLogger', `→ GET ${targetUrl}`, {
      session: sessionId?.slice(0, 8) || '?',
    });

    try {
      const response = await httpService.request({
        url: targetUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${req.userSession.accessToken}`,
          'X-Session-ID': sessionId,
        },
        responseType: 'arraybuffer',
      });
      Logger.debug('RequestLogger', `← ${response.status} OK`, {
        session: sessionId?.slice(0, 8) || '?',
        url: targetUrl,
      });
      res.set('Content-Type', response.headers['content-type'] as string);
      res.status(response.status).send(response.data);
    } catch (error) {
      const status = error.status || error.response?.status || 500;
      Logger.warn('RequestLogger', `← ${status} ${error.message}`, {
        session: sessionId?.slice(0, 8) || '?',
        url: targetUrl,
      });
      res.status(status).send(error.response?.data || { message: error.message });
    }
  }

  @Post('*')
  @UseGuards(SessionGuard, CsrfGuard)
  async proxyPost(@Param('0') path: string, @Req() req: any, @Res() res: Response) {
    const sessionId = req.cookies?.SESSION_ID;
    const targetUrl = `${config.protectedServiceUrl}/${path}`;

    Logger.debug('RequestLogger', `→ POST ${targetUrl}`, {
      session: sessionId?.slice(0, 8) || '?',
    });

    try {
      const response = await httpService.request({
        url: targetUrl,
        method: 'POST',
        data: req.body,
        headers: {
          'Authorization': `Bearer ${req.userSession.accessToken}`,
          'X-Session-ID': sessionId,
        },
        responseType: 'arraybuffer',
      });
      Logger.debug('RequestLogger', `← ${response.status} OK`, {
      session: sessionId?.slice(0, 8) || '?',
        url: targetUrl,
      });
      res.set('Content-Type', response.headers['content-type'] as string);
      res.status(response.status).send(response.data);
    } catch (error) {
      const status = error.status || error.response?.status || 500;
      Logger.warn('RequestLogger', `← ${status} ${error.message}`, {
        session: sessionId?.slice(0, 8) || '?',
        url: targetUrl,
      });
      res.status(status).send(error.response?.data || { message: error.message });
    }
  }
}
