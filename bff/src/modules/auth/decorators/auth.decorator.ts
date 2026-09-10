import { createParamDecorator, ExecutionContext,SetMetadata } from '@nestjs/common';
import { Request } from 'express';

import { Session } from '@/modules/auth/types/session';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AuthSession = createParamDecorator((_: unknown, ctx: ExecutionContext): Session => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.session!;
});
