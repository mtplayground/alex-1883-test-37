import { Router } from 'express';
import { type AuthenticatedRequest, requireAuth } from '../auth/middleware.js';
import { prisma } from '../db/prisma.js';

const MAX_CAPTION_LENGTH = 2200;
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

function readPostId(value: unknown): string | undefined {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

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

    response.status(200).json({ post });
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
