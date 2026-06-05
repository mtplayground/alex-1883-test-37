import { Router } from 'express';
import { buildGoogleAuthorizationUrl, GoogleOAuthError } from '../auth/google.js';
import { signInWithGoogleCode } from '../auth/service.js';

export const authRouter = Router();

function readQueryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

authRouter.get('/google', (request, response) => {
  const state = readQueryString(request.query.state);

  response.redirect(buildGoogleAuthorizationUrl(state));
});

authRouter.get('/google/callback', async (request, response) => {
  const code = readQueryString(request.query.code);

  if (!code) {
    response.status(400).json({
      error: 'missing_google_code',
      message: 'Google OAuth callback requires a code query parameter.',
    });
    return;
  }

  try {
    const session = await signInWithGoogleCode(code);
    response.status(200).json(session);
  } catch (error) {
    console.error('Google OAuth callback failed', error);

    if (error instanceof GoogleOAuthError) {
      response.status(400).json({
        error: 'google_oauth_failed',
        message: error.message,
      });
      return;
    }

    response.status(500).json({
      error: 'session_issuance_failed',
      message: 'Unable to complete Google sign-in.',
    });
  }
});
