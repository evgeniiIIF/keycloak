export interface SessionUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface Session {
  id: string;
  user: SessionUser;
  tokens: SessionTokens;
  csrfToken: string;
}
