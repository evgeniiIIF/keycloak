import { Controller, Get, Post, Put, Delete, Patch, Req, Param } from '@nestjs/common';
import { Request } from 'express';
import { HttpClient } from '../services/http-client';
import { config } from '../config/config';
import { RequireSession, RequireCsrf } from '../decorators/auth.decorator';

@Controller('api/service')
@RequireSession()
export class ProxyController {
  constructor(private http: HttpClient) {}

  @Get()
  async getRoot() {
    return this.http.get(`${config.protectedServiceUrl}/`);
  }

  @Get('*')
  async get(@Param('0') path: string) {
    return this.http.get(`${config.protectedServiceUrl}/${path}`);
  }

  @Post('*')
  @RequireCsrf()
  async post(@Param('0') path: string, @Req() req: Request) {
    return this.http.post(`${config.protectedServiceUrl}/${path}`, req.body);
  }

  @Put('*')
  @RequireCsrf()
  async put(@Param('0') path: string, @Req() req: Request) {
    return this.http.put(`${config.protectedServiceUrl}/${path}`, req.body);
  }

  @Delete('*')
  @RequireCsrf()
  async delete(@Param('0') path: string) {
    return this.http.delete(`${config.protectedServiceUrl}/${path}`);
  }

  @Patch('*')
  @RequireCsrf()
  async patch(@Param('0') path: string, @Req() req: Request) {
    return this.http.patch(`${config.protectedServiceUrl}/${path}`, req.body);
  }
}
