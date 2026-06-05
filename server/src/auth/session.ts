import type { User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getAppConfig } from '../config/env.js';

export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = Pick<
  User,
  'avatarUrl' | 'email' | 'googleId' | 'id' | 'name'
>;

export type IssuedSession = {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: SessionUser;
};

export function issueJwtSession(user: SessionUser): IssuedSession {
  const config = getAppConfig();
  const accessToken = jwt.sign(
    {
      email: user.email,
      googleId: user.googleId,
      name: user.name,
    },
    config.auth.jwtSecret,
    {
      audience: 'myclawteam:web',
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      issuer: 'myclawteam',
      subject: user.id,
    },
  );

  return {
    accessToken,
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    tokenType: 'Bearer',
    user,
  };
}
