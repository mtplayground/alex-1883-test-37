import { Router } from 'express';
import { type AuthenticatedRequest, requireAuth } from '../auth/middleware.js';
import { prisma } from '../db/prisma.js';

const MAX_CAPTION_LENGTH = 2200;

export const postsRouter = Router();

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
      select: {
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
      },
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
