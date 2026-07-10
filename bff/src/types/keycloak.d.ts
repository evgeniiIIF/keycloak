export interface TokenSet {
  access_token: string;
  refresh_token: string;
  id_token?: string;
}

export interface KeycloakJwtPayload {
  sub?: string;
  exp?: number;
  jti?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

export interface UserInfo {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
}
