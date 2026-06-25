import { Injectable } from '@nestjs/common';
import { redisClient } from '@configs/redis.config';
import { config } from '@configs/configuration';
import * as crypto from 'crypto';

export interface UserSession {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  userInfo: any;
  csrfToken: string;
  expiresAt: number;
}

@Injectable()
export class SessionService {
  private readonly SESSION_PREFIX = config.session.prefix;
  private readonly SESSION_TTL = config.session.ttl; // in seconds

  async createSession(tokens: any, userInfo: any): Promise<UserSession> {
    const sessionId = this.generateRandomId();
    const csrfToken = this.generateRandomId();

    const session: UserSession = {
      sessionId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      userInfo,
      csrfToken,
      expiresAt: Date.now() + this.SESSION_TTL * 1000,
    };

    await redisClient.set(
      this.SESSION_PREFIX + sessionId,
      JSON.stringify(session),
      'EX',
      this.SESSION_TTL
    );

    return session;
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    const data = await redisClient.get(this.SESSION_PREFIX + sessionId);
    if (!data) return null;
    return JSON.parse(data);
  }

  async updateTokens(sessionId: string, tokens: { accessToken: string, refreshToken: string }) {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    session.accessToken = tokens.accessToken;
    session.refreshToken = tokens.refreshToken;

    await redisClient.set(
      this.SESSION_PREFIX + sessionId,
      JSON.stringify(session),
      'EX',
      this.SESSION_TTL
    );
  }

  async deleteSession(sessionId: string) {
    await redisClient.del(this.SESSION_PREFIX + sessionId);
  }

  private generateRandomId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
