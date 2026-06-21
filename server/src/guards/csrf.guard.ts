import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const csrfHeader = request.headers['x-csrf-token'];
    const session = request.userSession;

    if (!session || !csrfHeader || csrfHeader !== session.csrfToken) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
  }
}
