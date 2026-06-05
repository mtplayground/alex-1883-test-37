import { getAppConfig } from '../config/env.js';

export type ObjectStorageConfig = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  prefix: string;
  region: string;
  secretAccessKey: string;
};

export function readObjectStorageConfig(): ObjectStorageConfig {
  return getAppConfig().objectStorage;
}

export function buildObjectStorageKey(key: string, prefix: string): string {
  const normalizedKey = key.trim().replace(/^\/+/, '');

  if (!normalizedKey) {
    throw new Error('Object storage key must not be empty.');
  }

  return prefix ? `${prefix}/${normalizedKey}` : normalizedKey;
}
