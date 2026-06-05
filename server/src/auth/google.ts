import { getAppConfig } from '../config/env.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export type GoogleTokenSet = {
  accessToken: string;
  expiresIn: number;
  idToken?: string;
  scope?: string;
  tokenType: string;
};

export type GoogleUserProfile = {
  avatarUrl: string | null;
  email: string;
  googleId: string;
  name: string;
};

export class GoogleOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

async function readErrorResponse(response: Response): Promise<string> {
  const body = await response.text();

  return body.slice(0, 500);
}

export function buildGoogleAuthorizationUrl(state?: string): string {
  const config = getAppConfig();
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set('client_id', config.auth.googleClientId);
  url.searchParams.set('redirect_uri', config.auth.googleOAuthRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account');

  if (state) {
    url.searchParams.set('state', state);
  }

  return url.toString();
}

export async function exchangeGoogleCodeForToken(
  code: string,
): Promise<GoogleTokenSet> {
  const config = getAppConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: config.auth.googleClientId,
      client_secret: config.auth.googleClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.auth.googleOAuthRedirectUri,
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const details = await readErrorResponse(response);
    throw new GoogleOAuthError(`Google token exchange failed: ${details}`);
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new GoogleOAuthError('Google token response was not an object.');
  }

  const accessToken = readString(payload.access_token);
  const tokenType = readString(payload.token_type);
  const expiresIn = payload.expires_in;

  if (!accessToken || !tokenType || typeof expiresIn !== 'number') {
    throw new GoogleOAuthError('Google token response was missing required fields.');
  }

  const tokenSet: GoogleTokenSet = {
    accessToken,
    expiresIn,
    tokenType,
  };

  const idToken = readString(payload.id_token);
  const scope = readString(payload.scope);

  if (idToken) {
    tokenSet.idToken = idToken;
  }

  if (scope) {
    tokenSet.scope = scope;
  }

  return tokenSet;
}

export async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<GoogleUserProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const details = await readErrorResponse(response);
    throw new GoogleOAuthError(`Google profile fetch failed: ${details}`);
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new GoogleOAuthError('Google profile response was not an object.');
  }

  const googleId = readString(payload.sub);
  const email = readString(payload.email);
  const name = readString(payload.name);
  const avatarUrl = readString(payload.picture) ?? null;

  if (!googleId || !email || !name) {
    throw new GoogleOAuthError('Google profile response was missing required fields.');
  }

  if (payload.email_verified !== true) {
    throw new GoogleOAuthError('Google account email is not verified.');
  }

  return {
    avatarUrl,
    email,
    googleId,
    name,
  };
}
