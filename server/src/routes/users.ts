import { Router } from 'express';
import {
  type AuthenticatedRequest,
  readAuthenticatedPrincipal,
  requireAuth,
} from '../auth/middleware.js';
import { prisma } from '../db/prisma.js';
import { createSignedObjectUrl } from '../storage/index.js';

const MAX_PROFILE_POSTS = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const usersRouter = Router();

const profilePostSelect = {
  author: {
    select: {
      avatarUrl: true,
      id: true,
      name: true,
    },
  },
  caption: true,
  createdAt: true,
  id: true,
  imageKey: true,
  updatedAt: true,
} as const;

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

async function countPostLikes(postId: string): Promise<number> {
  return prisma.like.count({
    where: { postId },
  });
}

async function countPostComments(postId: string): Promise<number> {
  return prisma.comment.count({
    where: { postId },
  });
}

async function readFollowSummary(viewerId: string | null, targetUserId: string) {
  const [followerCount, followingCount, viewerFollow] = await Promise.all([
    prisma.follow.count({
      where: { followingId: targetUserId },
    }),
    prisma.follow.count({
      where: { followerId: targetUserId },
    }),
    viewerId && viewerId !== targetUserId
      ? prisma.follow.findUnique({
          select: { id: true },
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: targetUserId,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    followerCount,
    followingCount,
    followedByViewer: Boolean(viewerFollow),
    userId: targetUserId,
  };
}

async function serializeProfilePost<TPost extends { id: string; imageKey: string }>(
  post: TPost,
  viewerId: string | null,
): Promise<
  TPost & {
    commentCount: number;
    imageUrl: string;
    likeCount: number;
    likedByViewer: boolean;
  }
> {
  const [imageUrl, likeCount, commentCount, viewerLike] = await Promise.all([
    createSignedObjectUrl({ key: post.imageKey }),
    countPostLikes(post.id),
    countPostComments(post.id),
    viewerId
      ? prisma.like.findUnique({
          select: { id: true },
          where: {
            userId_postId: {
              postId: post.id,
              userId: viewerId,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    ...post,
    commentCount,
    imageUrl,
    likeCount,
    likedByViewer: Boolean(viewerLike),
  };
}

usersRouter.get('/users/:userId/profile', async (request, response) => {
  const targetUserId = readUserId(request.params.userId);

  if (!targetUserId) {
    response.status(400).json({
      error: 'invalid_user_id',
      message: 'User ID must be a valid UUID.',
    });
    return;
  }

  const principal = readAuthenticatedPrincipal(request);

  try {
    const user = await prisma.user.findUnique({
      select: {
        avatarUrl: true,
        createdAt: true,
        email: true,
        id: true,
        name: true,
      },
      where: { id: targetUserId },
    });

    if (!user) {
      response.status(404).json({
        error: 'user_not_found',
        message: 'User was not found.',
      });
      return;
    }

    const [followSummary, postCount, posts] = await Promise.all([
      readFollowSummary(principal?.userId ?? null, targetUserId),
      prisma.post.count({
        where: { authorId: targetUserId },
      }),
      prisma.post.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: profilePostSelect,
        take: MAX_PROFILE_POSTS,
        where: { authorId: targetUserId },
      }),
    ]);

    const serializedPosts = await Promise.all(
      posts.map((post) => serializeProfilePost(post, principal?.userId ?? null)),
    );

    response.status(200).json({
      posts: serializedPosts,
      profile: {
        ...followSummary,
        postCount,
        user,
      },
    });
  } catch (error) {
    console.error('Get profile failed', error);
    response.status(500).json({
      error: 'get_profile_failed',
      message: 'Unable to load profile.',
    });
  }
});

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
