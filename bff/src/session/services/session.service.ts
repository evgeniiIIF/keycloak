import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/services/redis.service';
import { config } from '../../config/config';
import { KeycloakJwtPayload, TokenSet } from '../../types/keycloak';
import type { Session, SessionUser, SessionTokens } from '../../types/session';

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  async create(
    idPayload: KeycloakJwtPayload,
    tokenSet: TokenSet,
    userId: string,
  ): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      user: this.buildUser(idPayload),
      tokens: this.buildTokens(tokenSet),
    };

    await this.redis.client.set(this.sessionKey(session.id), JSON.stringify(session), {
      EX: config.session.ttl,
    });
    await this.redis.addUserSession(userId, session.id);
    return session;
  }

  async get(id: string): Promise<Session | null> {
    const raw = await this.redis.client.get(this.sessionKey(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async updateTokens(id: string, tokens: SessionTokens): Promise<void> {
    const session = await this.getOrFail(id);
    session.tokens = tokens;
    await this.redis.client.set(this.sessionKey(id), JSON.stringify(session), {
      EX: config.session.ttl,
    });
  }

  async touch(sessionId: string, userId: string): Promise<void> {
    await this.redis.refreshSessionStoreTtl(sessionId);
    await this.redis.refreshUserSessionTtl(userId);
  }

  async destroy(id: string, userId: string): Promise<void> {
    await this.redis.client.del(this.sessionKey(id));
    await this.redis.removeUserSession(userId, id);
  }

  async destroyAllSessions(userId: string): Promise<void> {
    await this.redis.deleteUserSessions(userId);
  }

  private async getOrFail(id: string): Promise<Session> {
    const session = await this.get(id);
    if (!session) throw new UnauthorizedException('Session not found');
    return session;
  }

  private buildUser(idPayload: KeycloakJwtPayload): SessionUser {
    return {
      id: idPayload.sub,
      username: idPayload.preferred_username,
      email: idPayload.email,
      roles: this.extractRoles(idPayload),
    };
  }

  private buildTokens(tokenSet: TokenSet): SessionTokens {
    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
    };
  }

  private extractRoles(idPayload: KeycloakJwtPayload): string[] {
    const realm = idPayload.realm_access?.roles || [];
    const client = Object.values(idPayload.resource_access || {}).flatMap((c) => c.roles || []);
    return [...realm, ...client];
  }

  private sessionKey(id: string): string {
    return `${config.session.prefix}${id}`;
  }
}
