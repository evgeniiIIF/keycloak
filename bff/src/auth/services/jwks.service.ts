import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { config } from '../../config/config';

@Injectable()
export class JwksService {
  private readonly jwks = createRemoteJWKSet(
    new URL(`${config.keycloak.issuer}/protocol/openid-connect/certs`),
  );

  getJWKS() {
    return this.jwks;
  }
}
