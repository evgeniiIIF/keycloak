import { createRemoteJWKSet } from 'jose';

import { AppConfigService } from '@/config/app-config.service';
import { JwksService } from '@/modules/auth/services/jwks.service';

// Мокаем jose
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue(jest.fn()),
}));

describe('JwksService (unit)', () => {
  let jwksService: JwksService;

  beforeEach(() => {
    const configMock = {
      keycloak: { issuer: 'http://localhost:8080/realms/TestRealm' },
    } as unknown as AppConfigService;

    jwksService = new JwksService(configMock);
  });

  it('создаёт JWKS с правильным URL', () => {
    const mockedCreate = createRemoteJWKSet as jest.Mock;
    
    expect(mockedCreate).toHaveBeenCalled();
    
    const urlArg = mockedCreate.mock.calls[0][0];
    expect(urlArg.toString()).toContain('/protocol/openid-connect/certs');
    expect(urlArg.toString()).toContain('/realms/TestRealm');
  });

  it('возвращает функцию JWKS из getJWKS', () => {
    const jwks = jwksService.getJWKS();
    
    expect(jwks).toBeDefined();
    expect(typeof jwks).toBe('function');
  });
});
