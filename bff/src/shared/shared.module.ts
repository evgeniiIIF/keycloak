import { Module, Global } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { SessionContextInterceptor } from './interceptors/session-context.interceptor';

@Global()
@Module({
  providers: [HttpExceptionFilter, SessionContextInterceptor],
  exports: [HttpExceptionFilter, SessionContextInterceptor],
})
export class SharedModule {}
