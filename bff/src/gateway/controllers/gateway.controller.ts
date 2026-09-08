import { BadRequestException,Controller, Delete, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { Request } from 'express';

import { config } from '../../config/config';
import { HttpClient } from '../services/http-client.service';

@Controller('api/service')
export class GatewayController {
  constructor(private http: HttpClient) {}

  @Get()
  async getRoot() {
    return this.http.get(`${config.protectedServiceUrl}/`);
  }

  @Get('*')
  async get(@Param('0') path: string) {
    const sanitizedPath = this.sanitizePath(path); // очищаем путь от ../
    return this.http.get(`${config.protectedServiceUrl}/${sanitizedPath}`);
  }

  @Post('*')
  async post(@Param('0') path: string, @Req() req: Request) {
    const sanitizedPath = this.sanitizePath(path); // очищаем путь от ../
    return this.http.post(`${config.protectedServiceUrl}/${sanitizedPath}`, req.body);
  }

  @Put('*')
  async put(@Param('0') path: string, @Req() req: Request) {
    const sanitizedPath = this.sanitizePath(path); // очищаем путь от ../
    return this.http.put(`${config.protectedServiceUrl}/${sanitizedPath}`, req.body);
  }

  @Delete('*')
  async delete(@Param('0') path: string) {
    const sanitizedPath = this.sanitizePath(path); // очищаем путь от ../
    return this.http.delete(`${config.protectedServiceUrl}/${sanitizedPath}`);
  }

  @Patch('*')
  async patch(@Param('0') path: string, @Req() req: Request) {
    const sanitizedPath = this.sanitizePath(path); // очищаем путь от ../
    return this.http.patch(`${config.protectedServiceUrl}/${sanitizedPath}`, req.body);
  }

  private sanitizePath(path: string): string {
    if (path.includes('..')) {
      throw new BadRequestException('Invalid path: path traversal is not allowed');
    }
    return path.replace(/^\//, '');
  }
}
