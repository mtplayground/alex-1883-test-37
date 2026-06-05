import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getAppConfig } from '../config/env.js';

const { JsonWebTokenError, TokenExpiredError } = jwt;

export type AuthenticatedPrincipal = {
  userId: string;
};

export type AuthenticatedRequest = Request & {
  auth: AuthenticatedPrincipal;
};

function readBearerToken(headerValue: string | undefined): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  const [scheme, token, extra] = headerValue.split(/\s+/);

  if (scheme !== 'Bearer' || !token || extra) {
    return undefined;
  }

  return token;
}

function isJwtPayload(value: string | jwt.JwtPayload): value is jwt.JwtPayload {
  return typeof value === 'object' && value !== null;
}

export function readAuthenticatedPrincipal(
  request: Request,
): AuthenticatedPrincipal | null {
  const token = readBearerToken(request.header('authorization'));

  if (!token) {
    return null;
  }

  try {
    const config = getAppConfig();
    const payload = jwt.verify(token, config.auth.jwtSecret, {
      audience: 'myclawteam:web',
      issuer: 'myclawteam',
    });

    if (!isJwtPayload(payload) || typeof payload.sub !== 'string') {
      return null;
    }

    return {
      userId: payload.sub,
    };
  } catch {
    return null;
  }
}

export function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const token = readBearerToken(request.header('authorization'));

  if (!token) {
    response.status(401).json({
      error: 'missing_bearer_token',
      message: 'Authorization header must be a Bearer token.',
    });
    return;
  }

  try {
    const config = getAppConfig();
    const payload = jwt.verify(token, config.auth.jwtSecret, {
      audience: 'myclawteam:web',
      issuer: 'myclawteam',
    });

    if (!isJwtPayload(payload) || typeof payload.sub !== 'string') {
      response.status(401).json({
        error: 'invalid_session_token',
        message: 'Session token payload is invalid.',
      });
      return;
    }

    (request as AuthenticatedRequest).auth = {
      userId: payload.sub,
    };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      response.status(401).json({
        error: 'session_expired',
        message: 'Session token has expired.',
      });
      return;
    }

    if (error instanceof JsonWebTokenError) {
      response.status(401).json({
        error: 'invalid_session_token',
        message: 'Session token is invalid.',
      });
      return;
    }

    console.error('Unexpected JWT verification failure', error);
    response.status(500).json({
      error: 'session_verification_failed',
      message: 'Unable to verify session token.',
    });
  }
}
