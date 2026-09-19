import { config } from '@/config/config';

// Единственный источник правды по ключам Redis.
// Все префиксы берутся из config — никаких хардкодов в других файлах.
// Если нужно добавить новый ключ — добавляй сюда, а не в сервисы.
export const RedisKeys = {
  // Префикс для хранения сессии: sess:<sessionId>
  session: (sessionId: string): string => `${config.session.prefix}${sessionId}`,

  // Связь пользователя с его активными сессиями: user_sessions:<userId>
  userSessions: (userId: string): string => `user_sessions:${userId}`,

  // Distributed lock на обновление токена: refresh_lock:<sessionId>
  refreshLock: (sessionId: string): string => `refresh_lock:${sessionId}`,

  // OAuth state (PKCE + CSRF): oauth_state:<state>
  oauthState: (state: string): string => `oauth_state:${state}`,

  // Защита от replay backchannel logout токенов: replay:<jti>
  replay: (jti: string): string => `replay:${jti}`,
} as const;

// TTL для ключей, у которых он фиксирован доменом (не из config).
// Всё, что зависит от конфигурации, берётся из config на месте.
export const RedisTtl = {
  // Время жизни записи о replay — перекрывает максимальное время жизни logout token
  replaySeconds: 300,

  // Время жизни distributed lock на обновление токена
  refreshLockSeconds: 30,
} as const;
