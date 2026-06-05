import { prisma } from '../db/prisma.js';
import {
  exchangeGoogleCodeForToken,
  fetchGoogleUserProfile,
  type GoogleUserProfile,
} from './google.js';
import { issueJwtSession, type IssuedSession, type SessionUser } from './session.js';

function toSessionUser(user: SessionUser): SessionUser {
  return {
    avatarUrl: user.avatarUrl,
    email: user.email,
    googleId: user.googleId,
    id: user.id,
    name: user.name,
  };
}

async function upsertUserFromGoogle(profile: GoogleUserProfile): Promise<SessionUser> {
  const user = await prisma.user.upsert({
    create: {
      avatarUrl: profile.avatarUrl,
      email: profile.email,
      googleId: profile.googleId,
      name: profile.name,
    },
    update: {
      avatarUrl: profile.avatarUrl,
      email: profile.email,
      name: profile.name,
    },
    where: {
      googleId: profile.googleId,
    },
  });

  return toSessionUser(user);
}

export async function signInWithGoogleCode(code: string): Promise<IssuedSession> {
  const tokenSet = await exchangeGoogleCodeForToken(code);
  const profile = await fetchGoogleUserProfile(tokenSet.accessToken);
  const user = await upsertUserFromGoogle(profile);

  return issueJwtSession(user);
}
