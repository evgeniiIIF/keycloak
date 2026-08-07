import type { JWTPayload } from 'jose';

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  id_token: string;
}

export interface KeycloakJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  preferred_username: string;
  name: string;
  realm_access: { roles?: string[] };
  resource_access: Record<string, { roles?: string[] }>;
}

export interface KeycloakErrorBody {
  error?: string;
  error_description?: string;
}
