import { Controller, Get, Post, Query, Res, UseInterceptors } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { config } from '@/config/config';
import { Session } from '@/modules/auth/types/session';
import { Logger } from '@/shared/logger/logger';

import { AuthSession, Public } from '../decorators/auth.decorator';
import { LogoutResponseDto, MeResponseDto } from '../dto/auth-responses.dto';
import { OAuthCallbackDto } from '../dto/oauth-callback.dto';
import { OAuthCallbackInterceptor } from '../interceptors/oauth-callback.interceptor';
import { AuthService } from '../services/auth.service';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('login')
  @ApiOperation({ summary: 'Инициировать OAuth2 flow — редирект на Keycloak' })
  @ApiResponse({ status: 302, description: 'Редирект на страницу входа Keycloak' })
  async login(@Res() res: Response) {
    const url = await this.authService.buildAuthorizationUrl();
    res.redirect(url);
  }

  @Public()
  @Get('callback')
  @UseInterceptors(OAuthCallbackInterceptor)
  @ApiOperation({ summary: 'Обработать ответ от Keycloak, создать сессию' })
  @ApiResponse({ status: 302, description: 'Редирект на фронтенд, установлены сессионные куки' })
  @ApiResponse({ status: 302, description: 'Редирект с ошибкой auth_failed' })
  async callback(@Query() query: OAuthCallbackDto, @Res() res: Response) {
    try {
      const session = await this.authService.exchangeCode(query.code, query.state);
      await this.authService.setSessionCookies(res, session);
      res.redirect(`${config.frontendUrl}/`);
    } catch (err) {
      Logger.error('AuthController', 'Callback failed', { error: (err as Error).message });
      res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
    }
  }

  @Get('api/me')
  @ApiCookieAuth('connect.sid')
  @ApiOperation({ summary: 'Получить данные текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Данные пользователя из сессии', type: MeResponseDto })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  me(@AuthSession() session: Session) {
    return { user: session.user };
  }

  @Post('logout')
  @ApiCookieAuth('connect.sid')
  @ApiOperation({ summary: 'Выйти из системы — удалить сессию и вернуть URL выхода из Keycloak' })
  @ApiResponse({ status: 200, description: 'URL для выхода из Keycloak', type: LogoutResponseDto })
  @ApiResponse({ status: 401, description: 'Не авторизован или невалидный CSRF' })
  async logout(@AuthSession() session: Session, @Res() res: Response) {
    const logoutUrl = await this.authService.logout(session);
    this.authService.clearSessionCookies(res);
    res.json({ logoutUrl });
  }
}
