import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';

import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class JwksService {
  private readonly jwks;

  constructor(config: AppConfigService) {
    this.jwks = createRemoteJWKSet(
      new URL(`${config.keycloak.issuer}/protocol/openid-connect/certs`),
    );
  }

  getJWKS() {
    return this.jwks;
  }
}
