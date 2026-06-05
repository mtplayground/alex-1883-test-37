import { Router } from 'express';
import {
  type AuthenticatedRequest,
  readAuthenticatedPrincipal,
  requireAuth,
} from '../auth/middleware.js';
import { prisma } from '../db/prisma.js';
import { createSignedObjectUrl } from '../storage/index.js';

const MAX_CAPTION_LENGTH = 2200;
const MAX_COMMENT_BODY_LENGTH = 1000;
const MAX_COMMENTS_PER_POST = 100;
const DEFAULT_FEED_LIMIT = 20;
const MAX_FEED_LIMIT = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const postsRouter = Router();

const postSelect = {
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

const commentSelect = {
  body: true,
  createdAt: true,
  id: true,
  postId: true,
  updatedAt: true,
  user: {
    select: {
      avatarUrl: true,
      id: true,
      name: true,
    },
  },
} as const;

type FeedCursor = {
  createdAt: Date;
  id: string;
};

type ParsedFeedCursor =
  | { cursor: FeedCursor; status: 'valid' }
  | { status: 'absent' | 'invalid' };

type FollowTableExistsRow = {
  exists: boolean;
};

type FollowRow = {
  following_id: string;
};

type SelectedComment = {
  body: string;
  createdAt: Date;
  id: string;
  postId: string;
  updatedAt: Date;
  user: {
    avatarUrl: string | null;
    id: string;
    name: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRequiredString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptionalCaption(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const caption = value.trim();

  if (!caption) {
    return null;
  }

  return caption;
}

function readCommentBody(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPostId(value: unknown): string | undefined {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

function readFeedLimit(value: unknown): number | undefined {
  if (value === undefined) {
    return DEFAULT_FEED_LIMIT;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return undefined;
  }

  const limit = Number.parseInt(value, 10);

  if (limit < 1 || limit > MAX_FEED_LIMIT) {
    return undefined;
  }

  return limit;
}

function parseFeedCursor(value: unknown): ParsedFeedCursor {
  if (value === undefined) {
    return { status: 'absent' };
  }

  if (typeof value !== 'string' || !value.trim()) {
    return { status: 'invalid' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      createdAt?: unknown;
      id?: unknown;
    };
    const postId = readPostId(decoded.id);

    if (typeof decoded.createdAt !== 'string' || !postId) {
      return { status: 'invalid' };
    }

    const createdAt = new Date(decoded.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      return { status: 'invalid' };
    }

    return {
      cursor: {
        createdAt,
        id: postId,
      },
      status: 'valid',
    };
  } catch {
    return { status: 'invalid' };
  }
}

function encodeFeedCursor(post: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: post.createdAt.toISOString(),
      id: post.id,
    }),
  ).toString('base64url');
}

async function serializePostWithImageUrl<TPost extends { imageKey: string }>(
  post: TPost,
): Promise<TPost & { imageUrl: string }> {
  const imageUrl = await createSignedObjectUrl({ key: post.imageKey });

  return {
    ...post,
    imageUrl,
  };
}

async function serializePostWithActivity<
  TPost extends { id: string; imageKey: string },
>(
  post: TPost,
  viewerId?: string,
): Promise<
  TPost & {
    commentCount: number;
    imageUrl: string;
    likeCount: number;
    likedByViewer: boolean;
  }
> {
  const [serializedPost, likeCount, commentCount, viewerLike] = await Promise.all([
    serializePostWithImageUrl(post),
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
    ...serializedPost,
    commentCount,
    likeCount,
    likedByViewer: Boolean(viewerLike),
  };
}

function serializeComment(comment: SelectedComment): Omit<SelectedComment, 'user'> & {
  author: SelectedComment['user'];
} {
  const { user, ...rest } = comment;

  return {
    ...rest,
    author: user,
  };
}

async function hasFollowsTable(): Promise<boolean> {
  const [row] = await prisma.$queryRaw<FollowTableExistsRow[]>`
    SELECT to_regclass('public.follows') IS NOT NULL AS exists
  `;

  return row?.exists ?? false;
}

async function readVisibleAuthorIds(userId: string): Promise<string[]> {
  if (!(await hasFollowsTable())) {
    return [userId];
  }

  const followRows = await prisma.$queryRaw<FollowRow[]>`
    SELECT following_id::text AS following_id
    FROM follows
    WHERE follower_id = ${userId}::uuid
  `;

  return Array.from(
    new Set([
      userId,
      ...followRows
        .map((row) => readPostId(row.following_id))
        .filter((id): id is string => Boolean(id)),
    ]),
  );
}

async function postExists(postId: string): Promise<boolean> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });

  return Boolean(post);
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

postsRouter.get('/feed', requireAuth, async (request, response) => {
  const limit = readFeedLimit(request.query.limit);
  const parsedCursor = parseFeedCursor(request.query.cursor);

  if (!limit) {
    response.status(400).json({
      error: 'invalid_feed_limit',
      message: `Feed limit must be an integer between 1 and ${MAX_FEED_LIMIT}.`,
    });
    return;
  }

  if (parsedCursor.status === 'invalid') {
    response.status(400).json({
      error: 'invalid_feed_cursor',
      message: 'Feed cursor is invalid.',
    });
    return;
  }

  const { userId } = (request as AuthenticatedRequest).auth;

  try {
    const visibleAuthorIds = await readVisibleAuthorIds(userId);
    const cursor = parsedCursor.status === 'valid' ? parsedCursor.cursor : undefined;
    const posts = await prisma.post.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: postSelect,
      take: limit + 1,
      where: {
        authorId: { in: visibleAuthorIds },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  createdAt: cursor.createdAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
    });
    const pagePosts = posts.slice(0, limit);
    const serializedPosts = await Promise.all(
      pagePosts.map((post) => serializePostWithActivity(post, userId)),
    );
    const nextPost = posts.length > limit ? pagePosts.at(-1) : undefined;

    response.status(200).json({
      pageInfo: {
        hasNextPage: Boolean(nextPost),
        nextCursor: nextPost ? encodeFeedCursor(nextPost) : null,
      },
      posts: serializedPosts,
    });
  } catch (error) {
    console.error('Feed fetch failed', error);
    response.status(500).json({
      error: 'feed_fetch_failed',
      message: 'Unable to load feed.',
    });
  }
});

postsRouter.post('/posts/:postId/like', requireAuth, async (request, response) => {
  const postId = readPostId(request.params.postId);

  if (!postId) {
    response.status(400).json({
      error: 'invalid_post_id',
      message: 'Post ID must be a valid UUID.',
    });
    return;
  }

  const { userId } = (request as AuthenticatedRequest).auth;

  try {
    if (!(await postExists(postId))) {
      response.status(404).json({
        error: 'post_not_found',
        message: 'Post was not found.',
      });
      return;
    }

    await prisma.like.upsert({
      create: {
        postId,
        userId,
      },
      update: {},
      where: {
        userId_postId: {
          postId,
          userId,
        },
      },
    });

    response.status(200).json({
      likeCount: await countPostLikes(postId),
      likedByViewer: true,
      postId,
    });
  } catch (error) {
    console.error('Like post failed', error);
    response.status(500).json({
      error: 'like_post_failed',
      message: 'Unable to like post.',
    });
  }
});

postsRouter.delete('/posts/:postId/like', requireAuth, async (request, response) => {
  const postId = readPostId(request.params.postId);

  if (!postId) {
    response.status(400).json({
      error: 'invalid_post_id',
      message: 'Post ID must be a valid UUID.',
    });
    return;
  }

  const { userId } = (request as AuthenticatedRequest).auth;

  try {
    if (!(await postExists(postId))) {
      response.status(404).json({
        error: 'post_not_found',
        message: 'Post was not found.',
      });
      return;
    }

    await prisma.like.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    response.status(200).json({
      likeCount: await countPostLikes(postId),
      likedByViewer: false,
      postId,
    });
  } catch (error) {
    console.error('Unlike post failed', error);
    response.status(500).json({
      error: 'unlike_post_failed',
      message: 'Unable to unlike post.',
    });
  }
});

postsRouter.get('/posts/:postId/comments', async (request, response) => {
  const postId = readPostId(request.params.postId);

  if (!postId) {
    response.status(400).json({
      error: 'invalid_post_id',
      message: 'Post ID must be a valid UUID.',
    });
    return;
  }

  try {
    if (!(await postExists(postId))) {
      response.status(404).json({
        error: 'post_not_found',
        message: 'Post was not found.',
      });
      return;
    }

    const [comments, commentCount] = await Promise.all([
      prisma.comment.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: commentSelect,
        take: MAX_COMMENTS_PER_POST,
        where: { postId },
      }),
      countPostComments(postId),
    ]);

    response.status(200).json({
      commentCount,
      comments: comments.map(serializeComment),
      postId,
    });
  } catch (error) {
    console.error('List comments failed', error);
    response.status(500).json({
      error: 'list_comments_failed',
      message: 'Unable to list comments.',
    });
  }
});

postsRouter.post('/posts/:postId/comments', requireAuth, async (request, response) => {
  const postId = readPostId(request.params.postId);

  if (!postId) {
    response.status(400).json({
      error: 'invalid_post_id',
      message: 'Post ID must be a valid UUID.',
    });
    return;
  }

  if (!isRecord(request.body)) {
    response.status(400).json({
      error: 'invalid_comment_body',
      message: 'Create-comment request body must be a JSON object.',
    });
    return;
  }

  const body = readCommentBody(request.body.body);

  if (!body || body.length > MAX_COMMENT_BODY_LENGTH) {
    response.status(400).json({
      error: 'invalid_comment_text',
      message: `Comment body must be a non-empty string up to ${MAX_COMMENT_BODY_LENGTH} characters.`,
    });
    return;
  }

  const { userId } = (request as AuthenticatedRequest).auth;

  try {
    if (!(await postExists(postId))) {
      response.status(404).json({
        error: 'post_not_found',
        message: 'Post was not found.',
      });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        body,
        postId,
        userId,
      },
      select: commentSelect,
    });

    response.status(201).json({
      comment: serializeComment(comment),
      commentCount: await countPostComments(postId),
      postId,
    });
  } catch (error) {
    console.error('Create comment failed', error);
    response.status(500).json({
      error: 'create_comment_failed',
      message: 'Unable to create comment.',
    });
  }
});

postsRouter.get('/posts/:postId', async (request, response) => {
  const postId = readPostId(request.params.postId);

  if (!postId) {
    response.status(400).json({
      error: 'invalid_post_id',
      message: 'Post ID must be a valid UUID.',
    });
    return;
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: postSelect,
    });

    if (!post) {
      response.status(404).json({
        error: 'post_not_found',
        message: 'Post was not found.',
      });
      return;
    }

    const principal = readAuthenticatedPrincipal(request);

    response
      .status(200)
      .json({ post: await serializePostWithActivity(post, principal?.userId) });
  } catch (error) {
    console.error('Get post failed', error);
    response.status(500).json({
      error: 'get_post_failed',
      message: 'Unable to get post.',
    });
  }
});

postsRouter.post('/posts', requireAuth, async (request, response) => {
  if (!isRecord(request.body)) {
    response.status(400).json({
      error: 'invalid_post_body',
      message: 'Create-post request body must be a JSON object.',
    });
    return;
  }

  const imageKey = readRequiredString(request.body.imageKey);
  const caption = readOptionalCaption(request.body.caption);

  if (!imageKey) {
    response.status(400).json({
      error: 'missing_image_key',
      message: 'Create-post request requires an imageKey.',
    });
    return;
  }

  if (caption === undefined || (caption && caption.length > MAX_CAPTION_LENGTH)) {
    response.status(400).json({
      error: 'invalid_caption',
      message: `Caption must be a string up to ${MAX_CAPTION_LENGTH} characters.`,
    });
    return;
  }

  const { userId } = (request as AuthenticatedRequest).auth;

  try {
    const post = await prisma.post.create({
      data: {
        authorId: userId,
        caption,
        imageKey,
      },
      select: postSelect,
    });

    response.status(201).json({ post });
  } catch (error) {
    console.error('Create post failed', error);
    response.status(500).json({
      error: 'create_post_failed',
      message: 'Unable to create post.',
    });
  }
});

postsRouter.delete('/posts/:postId', requireAuth, async (request, response) => {
  const postId = readPostId(request.params.postId);

  if (!postId) {
    response.status(400).json({
      error: 'invalid_post_id',
      message: 'Post ID must be a valid UUID.',
    });
    return;
  }

  const { userId } = (request as AuthenticatedRequest).auth;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, id: true },
    });

    if (!post) {
      response.status(404).json({
        error: 'post_not_found',
        message: 'Post was not found.',
      });
      return;
    }

    if (post.authorId !== userId) {
      response.status(403).json({
        error: 'post_forbidden',
        message: 'Only the post owner can delete this post.',
      });
      return;
    }

    await prisma.post.delete({
      where: { id: post.id },
    });

    response.status(204).send();
  } catch (error) {
    console.error('Delete post failed', error);
    response.status(500).json({
      error: 'delete_post_failed',
      message: 'Unable to delete post.',
    });
  }
});
