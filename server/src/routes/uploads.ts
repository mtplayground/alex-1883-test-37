import { Router } from 'express';
import multer from 'multer';
import { type AuthenticatedRequest, requireAuth } from '../auth/middleware.js';
import {
  createObjectKey,
  isObjectStorageConfigured,
  uploadObject,
} from '../storage/index.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedImageTypes = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const imageUpload = multer({
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
  storage: multer.memoryStorage(),
});

export const uploadsRouter = Router();

function parseImageUpload(
  request: Parameters<ReturnType<typeof imageUpload.single>>[0],
  response: Parameters<ReturnType<typeof imageUpload.single>>[1],
): Promise<void> {
  return new Promise((resolve, reject) => {
    imageUpload.single('image')(request, response, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function isAllowedImageType(mimeType: string): boolean {
  return allowedImageTypes.has(mimeType);
}

uploadsRouter.post('/uploads/images', requireAuth, async (request, response) => {
  try {
    if (!isObjectStorageConfigured()) {
      response.status(503).json({
        error: 'object_storage_unavailable',
        message: 'Image uploads are unavailable until object storage is configured.',
      });
      return;
    }

    await parseImageUpload(request, response);

    const { userId } = (request as AuthenticatedRequest).auth;
    const file = request.file;

    if (!file) {
      response.status(400).json({
        error: 'missing_image',
        message: 'Image upload requires a multipart file field named image.',
      });
      return;
    }

    if (!isAllowedImageType(file.mimetype)) {
      response.status(415).json({
        error: 'unsupported_image_type',
        message: 'Image must be a GIF, JPEG, PNG, or WebP file.',
      });
      return;
    }

    const imageKey = `users/${userId}/posts/${createObjectKey(file.originalname)}`;
    const uploaded = await uploadObject({
      body: file.buffer,
      cacheControl: 'public, max-age=31536000, immutable',
      contentType: file.mimetype,
      key: imageKey,
      metadata: {
        originalName: file.originalname,
        userId,
      },
    });

    response.status(201).json({
      image: {
        contentLength: uploaded.contentLength,
        contentType: file.mimetype,
        key: uploaded.key,
        storageKey: uploaded.storageKey,
      },
    });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        error: 'invalid_image_upload',
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Image must be 10 MB or smaller.'
            : error.message,
      });
      return;
    }

    console.error('Image upload failed', error);
    response.status(500).json({
      error: 'image_upload_failed',
      message: 'Unable to upload image.',
    });
  }
});
