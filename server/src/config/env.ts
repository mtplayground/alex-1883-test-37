import 'dotenv/config';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type NodeEnv = 'development' | 'production' | 'test';

export type AppConfig = {
  auth: {
    googleClientId: string;
    googleClientSecret: string;
    googleOAuthRedirectUri: string;
    googleOAuthEnabled: boolean;
    jwtSecret: string;
  };
  database: {
    url: string;
  };
  nodeEnv: NodeEnv;
  objectStorage: {
    accessKeyId: string;
    bucket: string;
    enabled: boolean;
    endpoint: string;
    forcePathStyle: boolean;
    prefix: string;
    region: string;
    secretAccessKey: string;
  };
  server: {
    host: string;
    port: number;
  };
};

let cachedConfig: AppConfig | undefined;

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

function readRequiredEnv(name: string): string {
  const value = readOptionalEnv(name);

  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = readOptionalEnv(name)?.toLowerCase();

  if (!value) {
    return defaultValue;
  }

  if (['1', 'true', 'yes'].includes(value)) {
    return true;
  }

  if (['0', 'false', 'no'].includes(value)) {
    return false;
  }

  throw new ConfigError(`Invalid boolean value for ${name}: ${process.env[name]}`);
}

function readPortEnv(name: string, defaultValue: number): number {
  const rawValue = readOptionalEnv(name);

  if (!rawValue) {
    return defaultValue;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new ConfigError(`Invalid port value for ${name}: ${rawValue}`);
  }

  return value;
}

function readNodeEnv(): NodeEnv {
  const value = readOptionalEnv('NODE_ENV') ?? 'development';

  if (value === 'development' || value === 'production' || value === 'test') {
    return value;
  }

  throw new ConfigError(`Invalid NODE_ENV value: ${value}`);
}

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) {
    return '';
  }

  return prefix.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function validateUrl(name: string, value: string): void {
  try {
    new URL(value);
  } catch {
    throw new ConfigError(`Invalid URL value for ${name}: ${value}`);
  }
}

function validateDatabaseUrl(value: string): void {
  if (!/^postgres(ql)?:\/\//.test(value)) {
    throw new ConfigError('DATABASE_URL must be a PostgreSQL connection string.');
  }

  validateUrl('DATABASE_URL', value);
}

export function validateAppConfig(config: AppConfig): AppConfig {
  validateDatabaseUrl(config.database.url);

  if (config.auth.googleOAuthEnabled) {
    validateUrl('GOOGLE_OAUTH_REDIRECT_URI', config.auth.googleOAuthRedirectUri);
  }

  if (config.objectStorage.enabled) {
    validateUrl('OBJECT_STORAGE_ENDPOINT', config.objectStorage.endpoint);
  }

  if (config.auth.jwtSecret.length < 32) {
    throw new ConfigError('JWT_SECRET must be at least 32 characters long.');
  }

  return config;
}

export function loadAppConfig(): AppConfig {
  const googleClientId = readOptionalEnv('GOOGLE_CLIENT_ID') ?? '';
  const googleClientSecret = readOptionalEnv('GOOGLE_CLIENT_SECRET') ?? '';
  const googleOAuthRedirectUri = readOptionalEnv('GOOGLE_OAUTH_REDIRECT_URI') ?? '';
  const objectStorageAccessKeyId =
    readOptionalEnv('OBJECT_STORAGE_ACCESS_KEY_ID') ?? '';
  const objectStorageBucket = readOptionalEnv('OBJECT_STORAGE_BUCKET') ?? '';
  const objectStorageEndpoint = readOptionalEnv('OBJECT_STORAGE_ENDPOINT') ?? '';
  const objectStorageSecretAccessKey =
    readOptionalEnv('OBJECT_STORAGE_SECRET_ACCESS_KEY') ?? '';

  return validateAppConfig({
    auth: {
      googleClientId,
      googleClientSecret,
      googleOAuthRedirectUri,
      googleOAuthEnabled: Boolean(
        googleClientId && googleClientSecret && googleOAuthRedirectUri,
      ),
      jwtSecret: readRequiredEnv('JWT_SECRET'),
    },
    database: {
      url: readRequiredEnv('DATABASE_URL'),
    },
    nodeEnv: readNodeEnv(),
    objectStorage: {
      accessKeyId: objectStorageAccessKeyId,
      bucket: objectStorageBucket,
      enabled: Boolean(
        objectStorageAccessKeyId &&
        objectStorageBucket &&
        objectStorageEndpoint &&
        objectStorageSecretAccessKey,
      ),
      endpoint: objectStorageEndpoint,
      forcePathStyle: readBooleanEnv('OBJECT_STORAGE_FORCE_PATH_STYLE', true),
      prefix: normalizePrefix(
        readOptionalEnv('OBJECT_STORAGE_PREFIX') ??
          readOptionalEnv('S3_PREFIX') ??
          readOptionalEnv('TIGRIS_PREFIX'),
      ),
      region: readOptionalEnv('OBJECT_STORAGE_REGION') ?? 'auto',
      secretAccessKey: objectStorageSecretAccessKey,
    },
    server: {
      host: readOptionalEnv('HOST') ?? '0.0.0.0',
      port: readPortEnv('PORT', 8080),
    },
  });
}

export function getAppConfig(): AppConfig {
  cachedConfig ??= loadAppConfig();

  return cachedConfig;
}

export function resetAppConfigForTests(): void {
  cachedConfig = undefined;
}
