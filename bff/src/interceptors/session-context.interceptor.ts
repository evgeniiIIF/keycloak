import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { requestContext } from '../shared/request-context';

@Injectable()
export class SessionContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const session = context.switchToHttp().getRequest().session;

    if (session?.accessToken) {
      return requestContext.run({ session }, () => next.handle());
    }

    return next.handle();
  }
}
