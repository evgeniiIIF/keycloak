import { Controller, Get, Post, Put, Delete, Patch, Req, Param } from '@nestjs/common';
import { Request } from 'express';
import { HttpClient } from '../services/http-client.service';
import { config } from '../../config/config';

@Controller('api/service')
export class GatewayController {
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
  async post(@Param('0') path: string, @Req() req: Request) {
    return this.http.post(`${config.protectedServiceUrl}/${path}`, req.body);
  }

  @Put('*')
  async put(@Param('0') path: string, @Req() req: Request) {
    return this.http.put(`${config.protectedServiceUrl}/${path}`, req.body);
  }

  @Delete('*')
  async delete(@Param('0') path: string) {
    return this.http.delete(`${config.protectedServiceUrl}/${path}`);
  }

  @Patch('*')
  async patch(@Param('0') path: string, @Req() req: Request) {
    return this.http.patch(`${config.protectedServiceUrl}/${path}`, req.body);
  }
}
