import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getObjectStorageClient } from './client.js';
import {
  buildObjectStorageKey,
  readObjectStorageConfig,
  type ObjectStorageConfig,
} from './config.js';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;
const MAX_SIGNED_URL_TTL_SECONDS = 60 * 60;

type UploadBody = Buffer | Uint8Array | string;

type ConcreteUploadBody = {
  body: Buffer | Uint8Array | string;
  contentLength: number;
};

export type UploadObjectInput = {
  body: UploadBody;
  cacheControl?: string;
  contentType: string;
  key: string;
  metadata?: Record<string, string>;
};

export type UploadedObject = {
  bucket: string;
  contentLength: number;
  key: string;
  storageKey: string;
};

export type SignedObjectUrlInput = {
  expiresInSeconds?: number;
  key: string;
};

function toConcreteUploadBody(body: UploadBody): ConcreteUploadBody {
  if (typeof body === 'string') {
    return {
      body,
      contentLength: Buffer.byteLength(body),
    };
  }

  return {
    body,
    contentLength: body.byteLength,
  };
}

function normalizeSignedUrlTtl(expiresInSeconds?: number): number {
  if (expiresInSeconds === undefined) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  if (
    !Number.isInteger(expiresInSeconds) ||
    expiresInSeconds <= 0 ||
    expiresInSeconds > MAX_SIGNED_URL_TTL_SECONDS
  ) {
    throw new Error(
      `Signed URL expiration must be between 1 and ${MAX_SIGNED_URL_TTL_SECONDS} seconds.`,
    );
  }

  return expiresInSeconds;
}

function getStorageKey(key: string, config: ObjectStorageConfig): string {
  return buildObjectStorageKey(key, config.prefix);
}

export function createObjectKey(filename: string): string {
  const extension = extname(filename).toLowerCase();

  return extension ? `${randomUUID()}${extension}` : randomUUID();
}

export async function uploadObject(input: UploadObjectInput): Promise<UploadedObject> {
  const config = readObjectStorageConfig();
  const storageKey = getStorageKey(input.key, config);
  const uploadBody = toConcreteUploadBody(input.body);

  await getObjectStorageClient().send(
    new PutObjectCommand({
      Body: uploadBody.body,
      Bucket: config.bucket,
      CacheControl: input.cacheControl,
      ContentLength: uploadBody.contentLength,
      ContentType: input.contentType,
      Key: storageKey,
      Metadata: input.metadata,
    }),
  );

  return {
    bucket: config.bucket,
    contentLength: uploadBody.contentLength,
    key: input.key,
    storageKey,
  };
}

export async function createSignedObjectUrl(
  input: SignedObjectUrlInput,
): Promise<string> {
  const config = readObjectStorageConfig();
  const storageKey = getStorageKey(input.key, config);
  const expiresIn = normalizeSignedUrlTtl(input.expiresInSeconds);

  return getSignedUrl(
    getObjectStorageClient(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    }),
    { expiresIn },
  );
}
