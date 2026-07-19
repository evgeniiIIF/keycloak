export const RedisKeys = {
  userSessions: (userId: string) => `user_sessions:${userId}`,
  refreshLock: (sessionId: string) => `refresh_lock:${sessionId}`,
  replay: (jti: string) => `replay:${jti}`,
  oauthState: (state: string) => `oauth_state:${state}`,
} as const;
