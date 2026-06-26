import { Injectable } from '@nestjs/common';
import { redisClient } from '@configs/redis.config';
import { config } from '@configs/configuration';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger';

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
  private readonly SESSION_TTL = config.session.ttl;

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

    if (userInfo?.sub) {
      await redisClient.sadd(`user_sessions:${userInfo.sub}`, sessionId);
      await redisClient.expire(`user_sessions:${userInfo.sub}`, this.SESSION_TTL);
    }

    Logger.info('SessionService', `Session ${sessionId.slice(0, 8)} created (user=${userInfo.preferred_username || userInfo.email})`);
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
    Logger.info('SessionService', `Tokens updated for session ${sessionId.slice(0, 8)}`);
  }

  async deleteSession(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (session?.userInfo?.sub) {
      await redisClient.srem(`user_sessions:${session.userInfo.sub}`, sessionId);
    }
    await redisClient.del(this.SESSION_PREFIX + sessionId);
    Logger.info('SessionService', `Session ${sessionId.slice(0, 8)} deleted`);
  }

  async deleteSessionsByUser(userId: string) {
    const sessionIds = await redisClient.smembers(`user_sessions:${userId}`);
    if (sessionIds.length === 0) return;

    const pipeline = redisClient.pipeline();
    for (const sid of sessionIds) {
      pipeline.del(this.SESSION_PREFIX + sid);
    }
    pipeline.del(`user_sessions:${userId}`);
    await pipeline.exec();
    Logger.info('SessionService', `Deleted ${sessionIds.length} sessions for user: ${userId}`);
  }

  private generateRandomId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
