export { getObjectStorageClient, resetObjectStorageClientForTests } from './client.js';
export {
  buildObjectStorageKey,
  readObjectStorageConfig,
  type ObjectStorageConfig,
} from './config.js';
export {
  createObjectKey,
  createSignedObjectUrl,
  uploadObject,
  type SignedObjectUrlInput,
  type UploadedObject,
  type UploadObjectInput,
} from './objects.js';
