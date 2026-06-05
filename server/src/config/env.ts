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
    jwtSecret: string;
  };
  database: {
    url: string;
  };
  nodeEnv: NodeEnv;
  objectStorage: {
    accessKeyId: string;
    bucket: string;
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

export function loadAppConfig(): AppConfig {
  return {
    auth: {
      googleClientId: readRequiredEnv('GOOGLE_CLIENT_ID'),
      googleClientSecret: readRequiredEnv('GOOGLE_CLIENT_SECRET'),
      googleOAuthRedirectUri: readRequiredEnv('GOOGLE_OAUTH_REDIRECT_URI'),
      jwtSecret: readRequiredEnv('JWT_SECRET'),
    },
    database: {
      url: readRequiredEnv('DATABASE_URL'),
    },
    nodeEnv: readNodeEnv(),
    objectStorage: {
      accessKeyId: readRequiredEnv('OBJECT_STORAGE_ACCESS_KEY_ID'),
      bucket: readRequiredEnv('OBJECT_STORAGE_BUCKET'),
      endpoint: readRequiredEnv('OBJECT_STORAGE_ENDPOINT'),
      forcePathStyle: readBooleanEnv('OBJECT_STORAGE_FORCE_PATH_STYLE', true),
      prefix: normalizePrefix(
        readOptionalEnv('OBJECT_STORAGE_PREFIX') ??
          readOptionalEnv('S3_PREFIX') ??
          readOptionalEnv('TIGRIS_PREFIX'),
      ),
      region: readOptionalEnv('OBJECT_STORAGE_REGION') ?? 'auto',
      secretAccessKey: readRequiredEnv('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
    },
    server: {
      host: readOptionalEnv('HOST') ?? '0.0.0.0',
      port: readPortEnv('PORT', 8080),
    },
  };
}

export function getAppConfig(): AppConfig {
  cachedConfig ??= loadAppConfig();

  return cachedConfig;
}

export function resetAppConfigForTests(): void {
  cachedConfig = undefined;
}
