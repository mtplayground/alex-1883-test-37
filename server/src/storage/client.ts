import { S3Client } from '@aws-sdk/client-s3';
import { readObjectStorageConfig } from './config.js';

let cachedClient: S3Client | undefined;

export function getObjectStorageClient(): S3Client {
  if (!cachedClient) {
    const config = readObjectStorageConfig();

    cachedClient = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      region: config.region,
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  return cachedClient;
}

export function resetObjectStorageClientForTests(): void {
  cachedClient = undefined;
}
