import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Загружаем .env из корня bff/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export async function getTokenViaPasswordGrant(
  username: string,
  password: string,
): Promise<{ access_token: string; refresh_token: string; id_token: string }> {
  const params = new URLSearchParams({
    client_id: process.env.KEYCLOAK_CLIENT_ID || 'bff-client',
    client_secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
    grant_type: 'password',
    username,
    password,
    scope: 'openid',
  });
  const response = await axios.post(
    `${process.env.KEYCLOAK_PUBLIC_ISSUER}/protocol/openid-connect/token`,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return response.data;
}
