import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CurrentUser } from '../api/auth';
import type { ApiClient } from '../api/client';
import type { AuthContextValue } from '../auth/AuthContext';
import { CreatePostForm } from './CreatePostForm';
import { FeedPage } from './FeedPage';
import { Header } from './Header';
import { PostActivity } from './PostActivity';

const mockAuth = vi.hoisted(() => ({
  value: {} as AuthContextValue,
}));

const mockPostsApi = vi.hoisted(() => ({
  createPost: vi.fn(),
  createPostComment: vi.fn(),
  getFeedPage: vi.fn(),
  likePost: vi.fn(),
  listPostComments: vi.fn(),
  unlikePost: vi.fn(),
  uploadPostImage: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockAuth.value,
}));

vi.mock('../api/posts', () => ({
  ALLOWED_IMAGE_TYPES: new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']),
  MAX_CAPTION_LENGTH: 2200,
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
  createPost: mockPostsApi.createPost,
  createPostComment: mockPostsApi.createPostComment,
  getFeedPage: mockPostsApi.getFeedPage,
  likePost: mockPostsApi.likePost,
  listPostComments: mockPostsApi.listPostComments,
  unlikePost: mockPostsApi.unlikePost,
  uploadPostImage: mockPostsApi.uploadPostImage,
}));

const testUser: CurrentUser = {
  avatarUrl: null,
  email: 'claw@example.test',
  googleId: 'google-claw',
  id: 'user-1',
  name: 'Claw Tester',
};

const apiClient = {
  request: vi.fn(),
} as unknown as ApiClient;

function setAuthState(overrides: Partial<AuthContextValue> = {}): void {
  mockAuth.value = {
    apiClient,
    refreshCurrentUser: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
    status: 'authenticated',
    token: 'test-token',
    user: testUser,
    ...overrides,
  };
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    author: {
      avatarUrl: null,
      id: 'author-1',
      name: 'Post Author',
    },
    caption: 'A tested post caption',
    commentCount: 2,
    createdAt: '2026-06-05T09:00:00.000Z',
    id: 'post-1',
    imageKey: 'users/author-1/posts/post-1.jpg',
    imageUrl: 'https://images.example.test/post-1.jpg',
    likeCount: 5,
    likedByViewer: false,
    updatedAt: '2026-06-05T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  setAuthState();
  vi.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:test-preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

describe('Header', () => {
  test('renders sign-in state and signed-in user state', () => {
    setAuthState({
      status: 'anonymous',
      token: null,
      user: null,
    });

    const { rerender } = render(<Header />);
    const signInButton = screen.getByRole('button', { name: 'Sign in' });

    expect(signInButton).not.toBeNull();
    expect((signInButton as HTMLButtonElement).disabled).toBe(false);

    setAuthState({
      status: 'authenticated',
      token: 'test-token',
      user: testUser,
    });
    rerender(<Header />);

    const profileLink = screen.getByRole('link', {
      name: 'Signed in as Claw Tester',
    });

    expect(profileLink.textContent).toContain('Claw Tester');
    expect(profileLink.getAttribute('href')).toBe('/users/user-1');
  });

  test('disables sign-in while auth status is loading', () => {
    setAuthState({
      status: 'loading',
      token: null,
      user: null,
    });

    render(<Header />);

    expect(
      (screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('FeedPage post card', () => {
  test('renders a feed post card with author, image, caption, and summaries', async () => {
    mockPostsApi.getFeedPage.mockResolvedValue({
      pageInfo: {
        hasNextPage: false,
        nextCursor: null,
      },
      posts: [makePost()],
    });
    mockPostsApi.listPostComments.mockResolvedValue({
      commentCount: 2,
      comments: [],
      postId: 'post-1',
    });

    renderWithClient(<FeedPage />);

    expect(await screen.findByText('Post Author')).not.toBeNull();
    expect(screen.getByText('A tested post caption')).not.toBeNull();
    expect(screen.getByText('5 likes')).not.toBeNull();
    expect(screen.getByText('2 comments')).not.toBeNull();
    expect(screen.getByRole('link', { name: '' }).getAttribute('href')).toBe(
      '/posts/post-1',
    );
  });
});

describe('CreatePostForm', () => {
  test('validates auth and submits image upload plus post creation', async () => {
    const user = userEvent.setup();
    const createdPost = makePost({
      caption: 'New caption',
      id: 'created-post',
      imageKey: 'uploaded-key',
    });

    mockPostsApi.uploadPostImage.mockImplementation(({ onProgress }) => {
      onProgress?.(64);

      return Promise.resolve({
        contentLength: 4,
        contentType: 'image/png',
        key: 'uploaded-key',
        storageKey: 'test/uploaded-key',
      });
    });
    mockPostsApi.createPost.mockResolvedValue(createdPost);

    renderWithClient(<CreatePostForm />);

    const submitButton = screen.getByRole('button', { name: 'Post' });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await user.upload(
      screen.getByLabelText('Image'),
      new File(['test'], 'claw.png', { type: 'image/png' }),
    );
    await user.type(screen.getByLabelText('Caption'), '  New caption  ');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    await screen.findByText('Post created.');

    expect(mockPostsApi.uploadPostImage).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ name: 'claw.png' }),
        token: 'test-token',
      }),
    );
    expect(mockPostsApi.createPost).toHaveBeenCalledWith(apiClient, {
      caption: 'New caption',
      imageKey: 'uploaded-key',
    });
    expect(screen.getByLabelText('Caption')).toHaveProperty('value', '');
  });

  test('disables post submission for anonymous users', () => {
    setAuthState({
      status: 'anonymous',
      token: null,
      user: null,
    });

    renderWithClient(<CreatePostForm />);

    expect(
      (screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('PostActivity', () => {
  test('loads comments and supports like and comment mutations', async () => {
    const user = userEvent.setup();

    mockPostsApi.listPostComments.mockResolvedValue({
      commentCount: 1,
      comments: [
        {
          author: {
            avatarUrl: null,
            id: 'commenter-1',
            name: 'Commenter One',
          },
          body: 'Existing comment',
          createdAt: '2026-06-05T09:10:00.000Z',
          id: 'comment-1',
          postId: 'post-activity',
          updatedAt: '2026-06-05T09:10:00.000Z',
        },
      ],
      postId: 'post-activity',
    });
    mockPostsApi.likePost.mockResolvedValue({
      likeCount: 4,
      likedByViewer: true,
      postId: 'post-activity',
    });
    mockPostsApi.createPostComment.mockResolvedValue({
      comment: {
        author: {
          avatarUrl: null,
          id: testUser.id,
          name: testUser.name,
        },
        body: 'New comment',
        createdAt: '2026-06-05T09:12:00.000Z',
        id: 'comment-2',
        postId: 'post-activity',
        updatedAt: '2026-06-05T09:12:00.000Z',
      },
      commentCount: 2,
      postId: 'post-activity',
    });

    renderWithClient(
      <PostActivity
        initialCommentCount={1}
        initialLikeCount={3}
        initiallyLikedByViewer={false}
        postId="post-activity"
      />,
    );

    expect(await screen.findByText('Existing comment')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Like' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Liked' })).not.toBeNull();
    });

    expect(screen.getByText('4 likes')).not.toBeNull();

    await user.type(screen.getByLabelText('Comment'), 'New comment');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('New comment')).not.toBeNull();
    expect(screen.getByText('2 comments')).not.toBeNull();
    expect(mockPostsApi.createPostComment).toHaveBeenCalledWith(
      apiClient,
      'post-activity',
      { body: 'New comment' },
    );
  });

  test('requires auth before liking posts', async () => {
    setAuthState({
      status: 'anonymous',
      token: null,
      user: null,
    });
    mockPostsApi.listPostComments.mockResolvedValue({
      commentCount: 0,
      comments: [],
      postId: 'post-anonymous',
    });

    const user = userEvent.setup();
    renderWithClient(<PostActivity postId="post-anonymous" />);

    await user.click(screen.getByRole('button', { name: 'Like' }));

    expect(screen.getByRole('alert').textContent).toBe('Sign in to like posts.');
  });
});
