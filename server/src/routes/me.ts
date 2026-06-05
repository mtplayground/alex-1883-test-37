import { Router } from 'express';
import { type AuthenticatedRequest, requireAuth } from '../auth/middleware.js';
import { prisma } from '../db/prisma.js';

export const meRouter = Router();

meRouter.get('/me', requireAuth, async (request, response) => {
  const { userId } = (request as AuthenticatedRequest).auth;

  try {
    const user = await prisma.user.findUnique({
      select: {
        avatarUrl: true,
        email: true,
        googleId: true,
        id: true,
        name: true,
      },
      where: {
        id: userId,
      },
    });

    if (!user) {
      response.status(401).json({
        error: 'invalid_session_user',
        message: 'Session user no longer exists.',
      });
      return;
    }

    response.status(200).json({ user });
  } catch (error) {
    console.error('Failed to load current user', error);
    response.status(500).json({
      error: 'current_user_lookup_failed',
      message: 'Unable to load the current user.',
    });
  }
});
