import { Module, Global } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';

@Global()
@Module({
  providers: [HttpExceptionFilter],
  exports: [HttpExceptionFilter],
})
export class SharedModule {}
