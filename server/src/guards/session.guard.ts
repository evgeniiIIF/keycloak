import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionService } from '@services/session.service';
import { AuthService } from '@services/auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private sessionService: SessionService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.cookies?.SESSION_ID;

    if (!sessionId) {
      throw new UnauthorizedException('No session found');
    }

    let session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    // Check if access token is expired (approx)
    // Better check: attempt to use it or check exp claim in JWT
    // For simplicity, let's check if the token is nearing expiration
    if (this.isTokenExpired(session.accessToken)) {
      try {
        await this.authService.refreshAccessToken(sessionId);
        session = await this.sessionService.getSession(sessionId);
      } catch (e) {
        throw new UnauthorizedException('Session expired');
      }
    }

    request.userSession = session;
    return true;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.exp * 1000 < Date.now() + 30000; // Expired or expires in 30s
    } catch {
      return true;
    }
  }
}
