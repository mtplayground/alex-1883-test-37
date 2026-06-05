export type ObjectStorageConfig = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  prefix: string;
  region: string;
  secretAccessKey: string;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required object storage environment variable: ${name}`);
  }

  return value;
}

function readOptionalBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return defaultValue;
  }

  if (['1', 'true', 'yes'].includes(value)) {
    return true;
  }

  if (['0', 'false', 'no'].includes(value)) {
    return false;
  }

  throw new Error(`Invalid boolean value for ${name}: ${process.env[name]}`);
}

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) {
    return '';
  }

  return prefix.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export function readObjectStorageConfig(): ObjectStorageConfig {
  return {
    accessKeyId: readRequiredEnv('OBJECT_STORAGE_ACCESS_KEY_ID'),
    bucket: readRequiredEnv('OBJECT_STORAGE_BUCKET'),
    endpoint: readRequiredEnv('OBJECT_STORAGE_ENDPOINT'),
    forcePathStyle: readOptionalBoolean('OBJECT_STORAGE_FORCE_PATH_STYLE', true),
    prefix: normalizePrefix(
      process.env.OBJECT_STORAGE_PREFIX ??
        process.env.S3_PREFIX ??
        process.env.TIGRIS_PREFIX,
    ),
    region: process.env.OBJECT_STORAGE_REGION?.trim() || 'auto',
    secretAccessKey: readRequiredEnv('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
  };
}

export function buildObjectStorageKey(key: string, prefix: string): string {
  const normalizedKey = key.trim().replace(/^\/+/, '');

  if (!normalizedKey) {
    throw new Error('Object storage key must not be empty.');
  }

  return prefix ? `${prefix}/${normalizedKey}` : normalizedKey;
}
