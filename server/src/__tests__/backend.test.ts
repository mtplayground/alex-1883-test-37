import type { Post, PrismaClient, User } from '@prisma/client';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test, { after, before } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type { IssuedSession, SessionUser } from '../auth/session.js';
import { ConfigError, type AppConfig } from '../config/env.js';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID ??= 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI ??= 'http://127.0.0.1:8080/auth/google/callback';
process.env.JWT_SECRET ??= 'issue-28-test-jwt-secret-at-least-32-characters';
process.env.OBJECT_STORAGE_ACCESS_KEY_ID ??= 'test-access-key';
process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ??= 'test-secret-key';
process.env.OBJECT_STORAGE_BUCKET ??= 'test-bucket';
process.env.OBJECT_STORAGE_ENDPOINT ??= 'https://storage.example.test';
process.env.OBJECT_STORAGE_REGION ??= 'auto';
process.env.OBJECT_STORAGE_PREFIX ??= 'issue-28-tests';
process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ??= 'true';

type TestModules = {
  createApp: () => Express;
  issueJwtSession: (user: SessionUser) => IssuedSession;
  prisma: PrismaClient;
};

type TestServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

type JsonResponse = {
  body: unknown;
  headers: Headers;
  status: number;
};

const validConfig: AppConfig = {
  auth: {
    googleClientId: 'test-client-id.apps.googleusercontent.com',
    googleClientSecret: 'test-google-client-secret',
    googleOAuthRedirectUri: 'http://127.0.0.1:8080/auth/google/callback',
    googleOAuthEnabled: true,
    jwtSecret: 'issue-31-test-jwt-secret-at-least-32-characters',
  },
  database: {
    url: 'postgresql://user:password@localhost:5432/myclawteam',
  },
  nodeEnv: 'test',
  objectStorage: {
    accessKeyId: 'test-access-key',
    bucket: 'test-bucket',
    enabled: true,
    endpoint: 'https://storage.example.test',
    forcePathStyle: true,
    prefix: 'issue-31-tests',
    region: 'auto',
    secretAccessKey: 'test-secret-key',
  },
  server: {
    host: '127.0.0.1',
    port: 8080,
  },
};

const runId = randomUUID();
let modules: TestModules;
let server: TestServer;

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);

  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));

  return value;
}

function toSessionUser(user: User): SessionUser {
  return {
    avatarUrl: user.avatarUrl,
    email: user.email,
    googleId: user.googleId,
    id: user.id,
    name: user.name,
  };
}

function authHeaders(user: User): Record<string, string> {
  const session = modules.issueJwtSession(toSessionUser(user));

  return {
    Authorization: `Bearer ${session.accessToken}`,
  };
}

async function startServer(app: Express): Promise<TestServer> {
  const httpServer = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => {
      resolve(listeningServer);
    });
  });
  const address = httpServer.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

async function requestJson(
  path: string,
  init: RequestInit = {},
): Promise<JsonResponse> {
  const headers = new Headers(init.headers);

  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${server.baseUrl}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();

  return {
    body: text ? (JSON.parse(text) as unknown) : null,
    headers: response.headers,
    status: response.status,
  };
}

async function createUser(label: string): Promise<User> {
  return modules.prisma.user.create({
    data: {
      avatarUrl: `https://avatars.example.test/${label}.png`,
      email: `${label}.${runId}@example.test`,
      googleId: `issue-28-${runId}-${label}`,
      name: `Issue 28 ${label}`,
    },
  });
}

async function createPost(author: User, label: string): Promise<Post> {
  return modules.prisma.post.create({
    data: {
      authorId: author.id,
      caption: `Caption for ${label}`,
      imageKey: `users/${author.id}/posts/${label}.jpg`,
    },
  });
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set before running backend tests.');
  }

  const [appModule, prismaModule, sessionModule] = await Promise.all([
    import('../app.js'),
    import('../db/prisma.js'),
    import('../auth/session.js'),
  ]);

  modules = {
    createApp: appModule.createApp,
    issueJwtSession: sessionModule.issueJwtSession,
    prisma: prismaModule.prisma,
  };
  server = await startServer(modules.createApp());
});

after(async () => {
  await modules.prisma.user.deleteMany({
    where: {
      googleId: {
        startsWith: `issue-28-${runId}-`,
      },
    },
  });
  await modules.prisma.$disconnect();
  await server.close();
});

test('config validation rejects unsafe deployment values', async () => {
  const { validateAppConfig } = await import('../config/env.js');

  assert.throws(
    () =>
      validateAppConfig({
        ...validConfig,
        database: {
          url: 'sqlite://local.db',
        },
      }),
    (error) => error instanceof ConfigError && /PostgreSQL/.test(error.message),
  );

  assert.throws(
    () =>
      validateAppConfig({
        ...validConfig,
        auth: {
          ...validConfig.auth,
          jwtSecret: 'short',
        },
      }),
    (error) => error instanceof ConfigError && /32/.test(error.message),
  );
});

test('central error handlers return structured JSON responses', async () => {
  const notFoundResponse = await requestJson('/route-that-does-not-exist');
  const notFoundBody = asRecord(notFoundResponse.body);

  assert.equal(notFoundResponse.status, 404);
  assert.equal(notFoundBody.error, 'route_not_found');

  const invalidJsonResponse = await fetch(`${server.baseUrl}/posts`, {
    body: '{',
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });
  const invalidJsonBody = asRecord(await invalidJsonResponse.json());

  assert.equal(invalidJsonResponse.status, 400);
  assert.equal(invalidJsonBody.error, 'invalid_json');
});

test('auth endpoints and session middleware issue and verify sessions', async () => {
  const user = await createUser('auth');
  const session = modules.issueJwtSession(toSessionUser(user));

  assert.equal(session.expiresIn, 60 * 60 * 24 * 7);
  assert.equal(session.tokenType, 'Bearer');
  assert.equal(session.user.id, user.id);

  const meResponse = await requestJson('/me', {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
  const meBody = asRecord(meResponse.body);
  const responseUser = asRecord(meBody.user);

  assert.equal(meResponse.status, 200);
  assert.equal(responseUser.id, user.id);
  assert.equal(responseUser.email, user.email);

  const missingAuthResponse = await requestJson('/me');
  const missingAuthBody = asRecord(missingAuthResponse.body);

  assert.equal(missingAuthResponse.status, 401);
  assert.equal(missingAuthBody.error, 'missing_bearer_token');

  const callbackResponse = await requestJson('/auth/google/callback');
  const callbackBody = asRecord(callbackResponse.body);

  assert.equal(callbackResponse.status, 400);
  assert.equal(callbackBody.error, 'missing_google_code');

  const redirectResponse = await fetch(`${server.baseUrl}/auth/google?state=abc`, {
    redirect: 'manual',
  });
  const location = redirectResponse.headers.get('location');

  assert.equal(redirectResponse.status, 302);
  assert.ok(location);
  assert.match(location, /accounts\.google\.com/);
  assert.match(location, /state=abc/);
});

test('post endpoints validate input, create, fetch, and enforce delete ownership', async () => {
  const author = await createUser('post-author');
  const otherUser = await createUser('post-other');

  const invalidCreateResponse = await requestJson('/posts', {
    body: JSON.stringify({ caption: 'missing image' }),
    headers: authHeaders(author),
    method: 'POST',
  });
  const invalidCreateBody = asRecord(invalidCreateResponse.body);

  assert.equal(invalidCreateResponse.status, 400);
  assert.equal(invalidCreateBody.error, 'missing_image_key');

  const createResponse = await requestJson('/posts', {
    body: JSON.stringify({
      caption: '  New backend-tested post  ',
      imageKey: 'users/test/posts/image.jpg',
    }),
    headers: authHeaders(author),
    method: 'POST',
  });
  const createBody = asRecord(createResponse.body);
  const createdPost = asRecord(createBody.post);

  assert.equal(createResponse.status, 201);
  assert.equal(createdPost.authorId, undefined);
  assert.equal(createdPost.caption, 'New backend-tested post');
  assert.equal(typeof createdPost.id, 'string');

  const getResponse = await requestJson(`/posts/${createdPost.id as string}`, {
    headers: authHeaders(author),
  });
  const getBody = asRecord(getResponse.body);
  const fetchedPost = asRecord(getBody.post);

  assert.equal(getResponse.status, 200);
  assert.equal(fetchedPost.id, createdPost.id);
  assert.equal(fetchedPost.likeCount, 0);
  assert.equal(fetchedPost.commentCount, 0);
  assert.equal(fetchedPost.likedByViewer, false);
  assert.equal(typeof fetchedPost.imageUrl, 'string');

  const forbiddenDeleteResponse = await requestJson(
    `/posts/${createdPost.id as string}`,
    {
      headers: authHeaders(otherUser),
      method: 'DELETE',
    },
  );
  const forbiddenDeleteBody = asRecord(forbiddenDeleteResponse.body);

  assert.equal(forbiddenDeleteResponse.status, 403);
  assert.equal(forbiddenDeleteBody.error, 'post_forbidden');

  const deleteResponse = await requestJson(`/posts/${createdPost.id as string}`, {
    headers: authHeaders(author),
    method: 'DELETE',
  });

  assert.equal(deleteResponse.status, 204);

  const missingPostResponse = await requestJson(`/posts/${createdPost.id as string}`);
  const missingPostBody = asRecord(missingPostResponse.body);

  assert.equal(missingPostResponse.status, 404);
  assert.equal(missingPostBody.error, 'post_not_found');
});

test('like and comment endpoints update activity counts', async () => {
  const author = await createUser('activity-author');
  const viewer = await createUser('activity-viewer');
  const post = await createPost(author, 'activity');

  const likeResponse = await requestJson(`/posts/${post.id}/like`, {
    headers: authHeaders(viewer),
    method: 'POST',
  });
  const likeBody = asRecord(likeResponse.body);

  assert.equal(likeResponse.status, 200);
  assert.equal(likeBody.postId, post.id);
  assert.equal(likeBody.likeCount, 1);
  assert.equal(likeBody.likedByViewer, true);

  const duplicateLikeResponse = await requestJson(`/posts/${post.id}/like`, {
    headers: authHeaders(viewer),
    method: 'POST',
  });
  const duplicateLikeBody = asRecord(duplicateLikeResponse.body);

  assert.equal(duplicateLikeResponse.status, 200);
  assert.equal(duplicateLikeBody.likeCount, 1);

  const invalidCommentResponse = await requestJson(`/posts/${post.id}/comments`, {
    body: JSON.stringify({ body: '   ' }),
    headers: authHeaders(viewer),
    method: 'POST',
  });
  const invalidCommentBody = asRecord(invalidCommentResponse.body);

  assert.equal(invalidCommentResponse.status, 400);
  assert.equal(invalidCommentBody.error, 'invalid_comment_text');

  const createCommentResponse = await requestJson(`/posts/${post.id}/comments`, {
    body: JSON.stringify({ body: '  First comment  ' }),
    headers: authHeaders(viewer),
    method: 'POST',
  });
  const createCommentBody = asRecord(createCommentResponse.body);
  const createdComment = asRecord(createCommentBody.comment);
  const commentAuthor = asRecord(createdComment.author);

  assert.equal(createCommentResponse.status, 201);
  assert.equal(createCommentBody.commentCount, 1);
  assert.equal(createdComment.body, 'First comment');
  assert.equal(commentAuthor.id, viewer.id);

  const listCommentsResponse = await requestJson(`/posts/${post.id}/comments`);
  const listCommentsBody = asRecord(listCommentsResponse.body);
  const comments = asArray(listCommentsBody.comments);

  assert.equal(listCommentsResponse.status, 200);
  assert.equal(listCommentsBody.commentCount, 1);
  assert.equal(comments.length, 1);

  const unlikeResponse = await requestJson(`/posts/${post.id}/like`, {
    headers: authHeaders(viewer),
    method: 'DELETE',
  });
  const unlikeBody = asRecord(unlikeResponse.body);

  assert.equal(unlikeResponse.status, 200);
  assert.equal(unlikeBody.likeCount, 0);
  assert.equal(unlikeBody.likedByViewer, false);
});

test('follow endpoints, profile summaries, and feed visibility use follow relationships', async () => {
  const viewer = await createUser('feed-viewer');
  const followed = await createUser('feed-followed');
  const stranger = await createUser('feed-stranger');
  const viewerPost = await createPost(viewer, 'viewer-feed');
  const followedPost = await createPost(followed, 'followed-feed');
  const strangerPost = await createPost(stranger, 'stranger-feed');

  const selfFollowResponse = await requestJson(`/users/${viewer.id}/follow`, {
    headers: authHeaders(viewer),
    method: 'POST',
  });
  const selfFollowBody = asRecord(selfFollowResponse.body);

  assert.equal(selfFollowResponse.status, 400);
  assert.equal(selfFollowBody.error, 'cannot_follow_self');

  const followResponse = await requestJson(`/users/${followed.id}/follow`, {
    headers: authHeaders(viewer),
    method: 'POST',
  });
  const followBody = asRecord(followResponse.body);

  assert.equal(followResponse.status, 200);
  assert.equal(followBody.userId, followed.id);
  assert.equal(followBody.followerCount, 1);
  assert.equal(followBody.followedByViewer, true);

  const profileResponse = await requestJson(`/users/${followed.id}/profile`, {
    headers: authHeaders(viewer),
  });
  const profileBody = asRecord(profileResponse.body);
  const profile = asRecord(profileBody.profile);
  const profilePosts = asArray(profileBody.posts);

  assert.equal(profileResponse.status, 200);
  assert.equal(profile.userId, followed.id);
  assert.equal(profile.followerCount, 1);
  assert.equal(profile.followedByViewer, true);
  assert.equal(profile.postCount, 1);
  assert.equal(profilePosts.length, 1);

  const feedResponse = await requestJson('/feed?limit=10', {
    headers: authHeaders(viewer),
  });
  const feedBody = asRecord(feedResponse.body);
  const feedPosts = asArray(feedBody.posts).map((value) => asRecord(value).id);

  assert.equal(feedResponse.status, 200);
  assert.ok(feedPosts.includes(viewerPost.id));
  assert.ok(feedPosts.includes(followedPost.id));
  assert.equal(feedPosts.includes(strangerPost.id), false);

  const unfollowResponse = await requestJson(`/users/${followed.id}/follow`, {
    headers: authHeaders(viewer),
    method: 'DELETE',
  });
  const unfollowBody = asRecord(unfollowResponse.body);

  assert.equal(unfollowResponse.status, 200);
  assert.equal(unfollowBody.followerCount, 0);
  assert.equal(unfollowBody.followedByViewer, false);
});
