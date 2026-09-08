import axios from 'axios';

import { KeycloakClient } from '@/auth/services/keycloak.service';

// Мокаем axios
jest.mock('axios');

describe('KeycloakClient (unit)', () => {
  let keycloakClient: KeycloakClient;
  let axiosPostMock: jest.Mock;

  beforeEach(() => {
    axiosPostMock = jest.fn();
    (axios.create as jest.Mock).mockReturnValue({
      post: axiosPostMock,
    });

    keycloakClient = new KeycloakClient();
  });

  describe('exchangeCode', () => {
    it('отправляет правильный запрос на обмен кода', async () => {
      const mockResponse = {
        data: { access_token: 'access', refresh_token: 'refresh', id_token: 'id' },
      };
      axiosPostMock.mockResolvedValue(mockResponse);

      const result = await keycloakClient.exchangeCode('code-123', 'verifier-123');

      // Проверяем, что axios.post вызван
      expect(axiosPostMock).toHaveBeenCalled();

      // Проверяем URL
      const url = axiosPostMock.mock.calls[0][0];
      expect(url).toContain('/protocol/openid-connect/token');

      // Проверяем параметры
      const body = axiosPostMock.mock.calls[0][1];
      expect(body.toString()).toContain('grant_type=authorization_code');
      expect(body.toString()).toContain('code=code-123');
      expect(body.toString()).toContain('code_verifier=verifier-123');

      expect(result.access_token).toBe('access');
    });
  });

  describe('refreshTokens', () => {
    it('отправляет правильный запрос на обновление токена', async () => {
      const mockResponse = {
        data: { access_token: 'new-access', refresh_token: 'new-refresh', id_token: 'new-id' },
      };
      axiosPostMock.mockResolvedValue(mockResponse);

      const result = await keycloakClient.refreshTokens('refresh-token-123');

      expect(axiosPostMock).toHaveBeenCalled();

      const body = axiosPostMock.mock.calls[0][1];
      expect(body.toString()).toContain('grant_type=refresh_token');
      expect(body.toString()).toContain('refresh_token=refresh-token-123');

      expect(result.access_token).toBe('new-access');
    });
  });

  describe('revokeRefreshToken', () => {
    it('отправляет правильный запрос на отзыв токена', async () => {
      axiosPostMock.mockResolvedValue({ data: {} });

      await keycloakClient.revokeRefreshToken('refresh-token-123');

      expect(axiosPostMock).toHaveBeenCalled();

      const url = axiosPostMock.mock.calls[0][0];
      expect(url).toContain('/protocol/openid-connect/revoke');

      const body = axiosPostMock.mock.calls[0][1];
      expect(body.toString()).toContain('token=refresh-token-123');
      expect(body.toString()).toContain('token_type_hint=refresh_token');
    });
  });
});
