import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { config } from '../../config/config';
import { RedisService } from '../../redis/services/redis.service';
import { KeycloakJwtPayload, TokenSet } from '../../types/keycloak';
import type { Session, SessionTokens,SessionUser } from '../../types/session';

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  // Создаем новую сессию пользователя и сохраняем ее в Redis
  async create(
    idTokenPayload: KeycloakJwtPayload,
    tokenSet: TokenSet,
    userId: string,
  ): Promise<Session> {
    const session = this.buildSession(idTokenPayload, tokenSet); // собираем объект сессии
    await this.saveSession(session);                       // сохраняем в Redis
    await this.redis.addUserSession(userId, session.id);    // связываем пользователя с сессией
    return session;
  }

  // Получаем сессию по ID или возвращаем null
  async get(id: string): Promise<Session | null> {
    const raw = await this.redis.client.get(this.sessionKey(id)); // читаем строку из Redis
    if (!raw) return null;                                      // сессии нет
    try {
      return JSON.parse(raw);                                    // парсим JSON
    } catch {
      return null;                                               // ошибка парсинга
    }
  }

  // Атомарно обновляем токены в сессии через Lua-скрипт для предотвращения race condition
  async updateTokens(id: string, tokens: SessionTokens): Promise<void> {
    const key = this.sessionKey(id);
    const script = `
      local session = redis.call('get', KEYS[1])
      if not session then return nil end
      local data = cjson.decode(session)
      data.tokens = cjson.decode(ARGV[1])
      redis.call('set', KEYS[1], cjson.encode(data), 'KEEPTTL')
      return 1
    `;

    const result = await this.redis.client.eval(script, {
      keys: [key],
      arguments: [JSON.stringify(tokens)]
    });

    if (!result) throw new UnauthorizedException('Session not found for token update'); // бросаем 401 если сессия пропала
  }

  // Продлеваем время жизни сессии в хранилище
  async touch(sessionId: string, userId: string): Promise<void> {
    await this.redis.refreshSessionStoreTtl(sessionId); // обновляем TTL самой сессии
    await this.redis.refreshUserSessionTtl(userId);      // обновляем TTL связи пользователя с сессией
  }

  // Полностью уничтожаем сессию и связь с пользователем
  async destroy(id: string, userId: string): Promise<void> {
    await this.redis.client.del(this.sessionKey(id)); // удаляем данные сессии
    await this.redis.removeUserSession(userId, id);    // удаляем связь пользователя с сессией
  }

  // Удаляем все активные сессии пользователя
  async destroyAllSessions(userId: string): Promise<void> {
    await this.redis.deleteUserSessions(userId); // очищаем все ключи пользователя
  }

  // --- Примитивы ---

  private async saveSession(session: Session): Promise<void> {
    await this.redis.client.set(this.sessionKey(session.id), JSON.stringify(session), {
      EX: config.session.ttl,
    });
  }

  private buildSession(idTokenPayload: KeycloakJwtPayload, tokenSet: TokenSet): Session {
    return {
      id: randomUUID(),
      user: this.buildUser(idTokenPayload),
      tokens: this.buildTokens(tokenSet),
    };
  }

  private buildUser(idTokenPayload: KeycloakJwtPayload): SessionUser {
    return {
      id: idTokenPayload.sub,
      username: idTokenPayload.preferred_username,
      email: idTokenPayload.email,
      roles: this.extractRoles(idTokenPayload),
    };
  }

  private buildTokens(tokenSet: TokenSet): SessionTokens {
    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
    };
  }

  private extractRoles(idTokenPayload: KeycloakJwtPayload): string[] {
    const realm = idTokenPayload.realm_access?.roles || [];
    const client = Object.values(idTokenPayload.resource_access || {}).flatMap((c) => c.roles || []);
    return [...realm, ...client];
  }

  private sessionKey(id: string): string {
    return `${config.session.prefix}${id}`;
  }
}
