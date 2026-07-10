import { Controller, Get, Post, Put, Delete, Patch, Req, Res, Param } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpClient } from '../services/http-client';
import { config } from '../config/config';
import { Logger } from '../shared/logger';
import { errorMessage } from '../shared/utils';

type HttpMethod = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

@Controller('api/service')
export class ProxyController {
  constructor(private http: HttpClient) {}

  @Get()
  async getRoot(@Res() res: Response) {
    return this.proxyGet('', res);
  }

  @Get('*')
  async get(@Param('0') path: string, @Res() res: Response) {
    return this.proxyGet(path, res);
  }

  @Post('*')
  async post(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
    return this.proxyMutate(path, req, res, 'POST');
  }

  @Put('*')
  async put(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
    return this.proxyMutate(path, req, res, 'PUT');
  }

  @Delete('*')
  async delete(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
    return this.proxyMutate(path, req, res, 'DELETE');
  }

  @Patch('*')
  async patch(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
    return this.proxyMutate(path, req, res, 'PATCH');
  }

  private async proxyGet(path: string, res: Response) {
    try {
      res.json(await this.http.get<any, any>(`${config.protectedServiceUrl}/${path}`));
    } catch (err: unknown) {
      this.proxyError(res, err, 'GET');
    }
  }

  private async proxyMutate(path: string, req: Request, res: Response, method: HttpMethod) {
    const url = `${config.protectedServiceUrl}/${path}`;
    try {
      const methodFn: Record<HttpMethod, () => Promise<any>> = {
        POST: () => this.http.post(url, req.body),
        PUT: () => this.http.put(url, req.body),
        DELETE: () => this.http.delete(url),
        PATCH: () => this.http.patch(url, req.body),
      };
      const result = await methodFn[method]();
      res.json(result);
    } catch (err: unknown) {
      this.proxyError(res, err, method);
    }
  }

  private proxyError(res: Response, err: unknown, method: string) {
    const msg = errorMessage(err);
    const status = (err as { response?: { status?: number } })?.response?.status;
    Logger.error('Proxy', `${method} failed: ${msg}`);
    res.status(status || 500).json({ error: 'Upstream request failed' });
  }
}
