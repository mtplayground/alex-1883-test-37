import { expect, test } from '@playwright/test';

const accessToken = 'e2e-access-token';
const currentUser = {
  avatarUrl: null,
  email: 'e2e@example.test',
  googleId: 'google-e2e',
  id: 'e2e-user',
  name: 'E2E User',
};

const createdPost = {
  author: {
    avatarUrl: null,
    id: currentUser.id,
    name: currentUser.name,
  },
  caption: 'E2E feed caption',
  commentCount: 0,
  createdAt: '2026-06-05T09:40:00.000Z',
  id: 'e2e-post',
  imageKey: `users/${currentUser.id}/posts/e2e.png`,
  imageUrl: 'https://images.example.test/e2e.png',
  likeCount: 0,
  likedByViewer: false,
  updatedAt: '2026-06-05T09:40:00.000Z',
};

test('mocked Google sign-in creates a post and shows it in the feed', async ({
  page,
}) => {
  let postCreated = false;

  await page.route('**/auth/google', async (route) => {
    await route.fulfill({
      body: `
        <!doctype html>
        <script>
          localStorage.setItem('myclawteam.accessToken', '${accessToken}');
          window.location.replace('/');
        </script>
      `,
      contentType: 'text/html',
      status: 200,
    });
  });

  await page.route('**/me', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${accessToken}`);

    await route.fulfill({
      body: JSON.stringify({ user: currentUser }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await page.route('**/feed**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        pageInfo: {
          hasNextPage: false,
          nextCursor: null,
        },
        posts: postCreated ? [createdPost] : [],
      }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await page.route('**/uploads/images', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers().authorization).toBe(`Bearer ${accessToken}`);

    await route.fulfill({
      body: JSON.stringify({
        image: {
          contentLength: 8,
          contentType: 'image/png',
          key: createdPost.imageKey,
          storageKey: `e2e/${createdPost.imageKey}`,
        },
      }),
      contentType: 'application/json',
      status: 201,
    });
  });

  await page.route('**/posts', async (route) => {
    const request = route.request();

    expect(request.method()).toBe('POST');
    expect(request.headers().authorization).toBe(`Bearer ${accessToken}`);
    expect(await request.postDataJSON()).toEqual({
      caption: createdPost.caption,
      imageKey: createdPost.imageKey,
    });

    postCreated = true;

    await route.fulfill({
      body: JSON.stringify({ post: createdPost }),
      contentType: 'application/json',
      status: 201,
    });
  });

  await page.route('**/posts/*/comments', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        commentCount: 0,
        comments: [],
        postId: createdPost.id,
      }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await page.goto('/');

  await expect(page.getByText('Sign in to see your feed.')).toBeVisible();

  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('link', { name: 'Signed in as E2E User' })).toBeVisible();
  await expect(page.getByText('Your feed is empty.')).toBeVisible();

  await page.getByRole('link', { name: 'Create' }).click();
  await page.setInputFiles('#post-image', {
    buffer: Buffer.from('fake-png'),
    mimeType: 'image/png',
    name: 'e2e.png',
  });
  await page.getByLabel('Caption').fill(createdPost.caption);
  await page.getByRole('button', { name: 'Post' }).click();

  await expect(page.getByText('Post created.')).toBeVisible();

  await page.getByRole('link', { name: 'myClawTeam home' }).click();

  await expect(page.getByText(createdPost.caption)).toBeVisible();
  await expect(page.getByText(currentUser.name).first()).toBeVisible();
  await expect(page.getByText('0 likes')).toBeVisible();
  await expect(page.getByText('0 comments')).toBeVisible();
});
