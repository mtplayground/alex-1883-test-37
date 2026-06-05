import { Router } from 'express';
import { type AuthenticatedRequest, requireAuth } from '../auth/middleware.js';
import { prisma } from '../db/prisma.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const usersRouter = Router();

function readUserId(value: unknown): string | undefined {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

async function userExists(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    select: { id: true },
    where: { id: userId },
  });

  return Boolean(user);
}

async function readFollowSummary(viewerId: string, targetUserId: string) {
  const [followerCount, followingCount, viewerFollow] = await Promise.all([
    prisma.follow.count({
      where: { followingId: targetUserId },
    }),
    prisma.follow.count({
      where: { followerId: targetUserId },
    }),
    prisma.follow.findUnique({
      select: { id: true },
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: targetUserId,
        },
      },
    }),
  ]);

  return {
    followerCount,
    followingCount,
    followedByViewer: Boolean(viewerFollow),
    userId: targetUserId,
  };
}

usersRouter.post('/users/:userId/follow', requireAuth, async (request, response) => {
  const targetUserId = readUserId(request.params.userId);

  if (!targetUserId) {
    response.status(400).json({
      error: 'invalid_user_id',
      message: 'User ID must be a valid UUID.',
    });
    return;
  }

  const { userId: viewerId } = (request as AuthenticatedRequest).auth;

  if (targetUserId === viewerId) {
    response.status(400).json({
      error: 'cannot_follow_self',
      message: 'Users cannot follow themselves.',
    });
    return;
  }

  try {
    if (!(await userExists(targetUserId))) {
      response.status(404).json({
        error: 'user_not_found',
        message: 'User was not found.',
      });
      return;
    }

    await prisma.follow.upsert({
      create: {
        followerId: viewerId,
        followingId: targetUserId,
      },
      update: {},
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: targetUserId,
        },
      },
    });

    response.status(200).json(await readFollowSummary(viewerId, targetUserId));
  } catch (error) {
    console.error('Follow user failed', error);
    response.status(500).json({
      error: 'follow_user_failed',
      message: 'Unable to follow user.',
    });
  }
});

usersRouter.delete('/users/:userId/follow', requireAuth, async (request, response) => {
  const targetUserId = readUserId(request.params.userId);

  if (!targetUserId) {
    response.status(400).json({
      error: 'invalid_user_id',
      message: 'User ID must be a valid UUID.',
    });
    return;
  }

  const { userId: viewerId } = (request as AuthenticatedRequest).auth;

  if (targetUserId === viewerId) {
    response.status(400).json({
      error: 'cannot_unfollow_self',
      message: 'Users cannot unfollow themselves.',
    });
    return;
  }

  try {
    if (!(await userExists(targetUserId))) {
      response.status(404).json({
        error: 'user_not_found',
        message: 'User was not found.',
      });
      return;
    }

    await prisma.follow.deleteMany({
      where: {
        followerId: viewerId,
        followingId: targetUserId,
      },
    });

    response.status(200).json(await readFollowSummary(viewerId, targetUserId));
  } catch (error) {
    console.error('Unfollow user failed', error);
    response.status(500).json({
      error: 'unfollow_user_failed',
      message: 'Unable to unfollow user.',
    });
  }
});
