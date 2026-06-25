import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '@services/session.service';
import { AuthService } from '@services/auth.service';
import { AxiosResponse } from 'axios';

@Injectable()
export class ProxyService {
  constructor(
    private httpService: HttpService,
    private sessionService: SessionService,
    private authService: AuthService,
  ) {}

  async proxyRequest(sessionId: string, targetUrl: string, method: string, data?: any, headers?: any): Promise<AxiosResponse> {
    let session = await this.sessionService.getSession(sessionId);
    if (!session) throw new UnauthorizedException('Invalid session');

    const executeRequest = async (token: string) => {
      return firstValueFrom(
        this.httpService.request({
          url: targetUrl,
          method,
          data,
          headers: {
            ...headers,
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer', // Handle binary data from MinIO
        })
      );
    };

    try {
      return await executeRequest(session.accessToken);
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Attempt token refresh
        const newToken = await this.authService.refreshAccessToken(sessionId);
        return await executeRequest(newToken);
      }
      throw error;
    }
  }
}
