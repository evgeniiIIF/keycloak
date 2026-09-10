import { BadRequestException, Controller, Delete, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { config } from '@/config/config';

import { HttpClient } from '../services/http-client.service';

@ApiTags('gateway')
@ApiCookieAuth('connect.sid')
@Controller('api/service')
export class GatewayController {
  constructor(private http: HttpClient) {}

  @Get()
  @ApiOperation({ summary: 'Проксировать GET / к защищённому сервису' })
  @ApiResponse({ status: 200, description: 'Ответ от защищённого сервиса' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  async getRoot() {
    return this.http.get(`${config.protectedServiceUrl}/`);
  }

  @Get('*')
  @ApiOperation({ summary: 'Проксировать GET-запрос по указанному пути' })
  @ApiResponse({ status: 200, description: 'Ответ от защищённого сервиса' })
  @ApiResponse({ status: 400, description: 'Невалидный путь' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  async get(@Param('0') path: string, @Req() req: Request) {
    const sanitizedPath = this.sanitizePath(path);
    return this.http.get(`${config.protectedServiceUrl}/${sanitizedPath}`, req.query);
  }

  @Post('*')
  @ApiOperation({ summary: 'Проксировать POST-запрос по указанному пути' })
  @ApiResponse({ status: 200, description: 'Ответ от защищённого сервиса' })
  @ApiResponse({ status: 400, description: 'Невалидный путь' })
  @ApiResponse({ status: 401, description: 'Не авторизован или невалидный CSRF' })
  async post(@Param('0') path: string, @Req() req: Request) {
    const sanitizedPath = this.sanitizePath(path);
    return this.http.post(`${config.protectedServiceUrl}/${sanitizedPath}`, req.body);
  }

  @Put('*')
  @ApiOperation({ summary: 'Проксировать PUT-запрос по указанному пути' })
  @ApiResponse({ status: 200, description: 'Ответ от защищённого сервиса' })
  @ApiResponse({ status: 401, description: 'Не авторизован или невалидный CSRF' })
  async put(@Param('0') path: string, @Req() req: Request) {
    const sanitizedPath = this.sanitizePath(path);
    return this.http.put(`${config.protectedServiceUrl}/${sanitizedPath}`, req.body);
  }

  @Delete('*')
  @ApiOperation({ summary: 'Проксировать DELETE-запрос по указанному пути' })
  @ApiResponse({ status: 200, description: 'Ответ от защищённого сервиса' })
  @ApiResponse({ status: 401, description: 'Не авторизован или невалидный CSRF' })
  async delete(@Param('0') path: string) {
    const sanitizedPath = this.sanitizePath(path);
    return this.http.delete(`${config.protectedServiceUrl}/${sanitizedPath}`);
  }

  @Patch('*')
  @ApiOperation({ summary: 'Проксировать PATCH-запрос по указанному пути' })
  @ApiResponse({ status: 200, description: 'Ответ от защищённого сервиса' })
  @ApiResponse({ status: 401, description: 'Не авторизован или невалидный CSRF' })
  async patch(@Param('0') path: string, @Req() req: Request) {
    const sanitizedPath = this.sanitizePath(path);
    return this.http.patch(`${config.protectedServiceUrl}/${sanitizedPath}`, req.body);
  }

  private sanitizePath(path: string): string {
    if (path.includes('..')) {
      throw new BadRequestException('Invalid path: path traversal is not allowed');
    }
    return path.replace(/^\//, '');
  }
}
