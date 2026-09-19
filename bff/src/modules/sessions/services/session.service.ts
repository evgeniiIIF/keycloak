import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';

import { KeycloakJwtPayload, TokenSet } from '@/modules/auth/types/keycloak';
import type { Session, SessionTokens, SessionUser } from '@/modules/auth/types/session';

import { SessionRepository } from '../repositories/session.repository';
import { UserSessionsRepository } from '../repositories/user-sessions.repository';

// Бизнес-логика сессий BFF.
// Создаёт сессию после OAuth callback, продлевает TTL при активности,
// обновляет токены, удаляет сессии локально и по пользователю.
@Injectable()
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly userSessions: UserSessionsRepository,
  ) {}

  // Создаём новую сессию пользователя и связываем её с userId
  async create(
    idTokenPayload: KeycloakJwtPayload,
    tokenSet: TokenSet,
    userId: string,
  ): Promise<Session> {
    const session = this.buildSession(idTokenPayload, tokenSet);    // собираем объект сессии
    await this.sessions.save(session);                              // сохраняем в Redis
    await this.userSessions.add(userId, session.id);                // индексируем по пользователю
    return session;
  }

  // Достаём сессию по id или null, если её нет
  async get(id: string): Promise<Session | null> {
    return this.sessions.find(id);
  }

  // Атомарно обновляем токены в сессии
  async updateTokens(id: string, tokens: SessionTokens): Promise<void> {
    const updated = await this.sessions.updateTokens(id, tokens);   // обновляем или false
    if (!updated) throw new UnauthorizedException('Session not found for token update');
  }

  // Продлеваем TTL сессии и индекса пользователя при активности
  async touch(sessionId: string, userId: string): Promise<void> {
    await this.sessions.touch(sessionId);                           // продлеваем сессию
    await this.userSessions.touch(userId);                          // продлеваем индекс пользователя
  }

  // Удаляем одну сессию и убираем её из индекса пользователя
  async destroy(id: string, userId: string): Promise<void> {
    await this.sessions.delete(id);                                 // удаляем сессию
    await this.userSessions.remove(userId, id);                     // убираем из индекса
  }

  // Удаляем все сессии пользователя (backchannel logout, "выйти везде")
  async destroyAllSessions(userId: string): Promise<void> {
    const sessionIds = await this.userSessions.findAll(userId);     // берём все id пользователя
    await this.deleteSessions(sessionIds);                          // удаляем сессии пачкой
    await this.userSessions.deleteIndex(userId);                    // удаляем сам индекс
  }

  // ── Примитивы ──────────────────────────────────────────────────

  // Удаляем сессии по списку id
  private async deleteSessions(sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return;                            // нечего удалять
    for (const id of sessionIds) await this.sessions.delete(id);    // удаляем по одной
  }

  // Собираем объект сессии из payload и токенов
  private buildSession(idTokenPayload: KeycloakJwtPayload, tokenSet: TokenSet): Session {
    return {
      id: randomUUID(),
      user: this.buildUser(idTokenPayload),
      tokens: this.buildTokens(tokenSet),
      csrfToken: this.generateCsrfToken(),
    };
  }

  // Собираем пользователя из id_token payload
  private buildUser(idTokenPayload: KeycloakJwtPayload): SessionUser {
    return {
      id: idTokenPayload.sub,
      username: idTokenPayload.preferred_username,
      email: idTokenPayload.email,
      roles: this.extractRoles(idTokenPayload),
    };
  }

  // Собираем токены из ответа Keycloak
  private buildTokens(tokenSet: TokenSet): SessionTokens {
    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
    };
  }

  // Генерируем CSRF-токен для double-submit cookie
  private generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
  }

  // Собираем роли из realm_access и resource_access
  private extractRoles(idTokenPayload: KeycloakJwtPayload): string[] {
    const realm = idTokenPayload.realm_access?.roles || [];
    const client = Object.values(idTokenPayload.resource_access || {}).flatMap((c) => c.roles || []);
    return [...realm, ...client];
  }
}
