import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { config } from '../config/config';
import { Logger } from '../shared/logger';
import { errorMessage } from '../shared/utils';

@Injectable()
export class JwksService implements OnModuleDestroy {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private timer: NodeJS.Timeout;

  constructor() {
    this.jwks = this.createJWKS();
    this.timer = setInterval(() => {
      try {
        this.jwks = this.createJWKS();
      } catch (err: unknown) {
        Logger.error('JwksService', `JWKS refresh failed: ${errorMessage(err)}`);
      }
    }, 60 * 60 * 1000);
  }

  getJWKS() {
    return this.jwks;
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private createJWKS() {
    return createRemoteJWKSet(
      new URL(`${config.keycloak.issuer}/protocol/openid-connect/certs`),
    );
  }
}
