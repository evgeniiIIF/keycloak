import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { config } from '../config/config';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!req.cookies['XSRF-TOKEN']) {
      const token = crypto.randomBytes(32).toString('hex');
      const isProd = config.nodeEnv === 'production';

      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        secure: isProd,
        sameSite: 'strict',
        path: '/',
      });

      if (req.session) {
        req.session.csrfToken = token;
        req.session.save(() => next());
        return;
      }
    }
    next();
  }
}
