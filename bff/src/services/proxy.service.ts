import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '../http/http.service';
import { SessionService } from '@services/session.service';
import { Logger } from '../utils/logger';

@Injectable()
export class ProxyService {
  constructor(
    private httpService: HttpService,
    private sessionService: SessionService,
  ) {}

  async proxyRequest(sessionId: string, targetUrl: string, method: string, data?: any, headers?: any) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) throw new UnauthorizedException('Invalid session');

    Logger.info('ProxyService', `${method} ${targetUrl}`);

    const response = await this.httpService.request({
      url: targetUrl,
      method,
      data,
      headers: {
        ...headers,
        'Authorization': `Bearer ${session.accessToken}`,
        'X-Session-ID': sessionId,
      },
      responseType: 'arraybuffer',
    });

    Logger.info('ProxyService', `Response: ${response.status}`);
    return response;
  }
}
