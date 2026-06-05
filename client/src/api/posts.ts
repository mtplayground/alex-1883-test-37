import { ApiClient, ApiError, buildApiUrl } from './client';
import type { CurrentUser } from './auth';

export const MAX_CAPTION_LENGTH = 2200;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type UploadedImage = {
  contentLength: number;
  contentType: string;
  key: string;
  storageKey: string;
};

export type Post = {
  author: Pick<CurrentUser, 'avatarUrl' | 'id' | 'name'>;
  caption: string | null;
  commentCount?: number;
  createdAt: string;
  id: string;
  imageKey: string;
  imageUrl?: string | null;
  likeCount?: number;
  likedByViewer?: boolean;
  updatedAt: string;
};

export type PostComment = {
  author: Pick<CurrentUser, 'avatarUrl' | 'id' | 'name'>;
  body: string;
  createdAt: string;
  id: string;
  postId: string;
  updatedAt: string;
};

type UploadImageResponse = {
  image: UploadedImage;
};

type CreatePostResponse = {
  post: Post;
};

type GetPostResponse = {
  post: Post;
};

type LikePostResponse = {
  likedByViewer: boolean;
  likeCount: number;
  postId: string;
};

type ListCommentsResponse = {
  commentCount: number;
  comments: PostComment[];
  postId: string;
};

type CreateCommentResponse = {
  comment: PostComment;
  commentCount: number;
  postId: string;
};

export type FeedPageInfo = {
  hasNextPage: boolean;
  nextCursor: string | null;
};

export type FeedPage = {
  pageInfo: FeedPageInfo;
  posts: Post[];
};

export type UploadImageOptions = {
  file: File;
  onProgress?: (progress: number) => void;
  token: string;
};

export type CreatePostInput = {
  caption: string | null;
  imageKey: string;
};

export type CreateCommentInput = {
  body: string;
};

export type GetFeedPageOptions = {
  cursor?: string | null;
  limit?: number;
};

function readJsonBody(responseText: string): unknown {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function readErrorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }

  return fallback;
}

export async function uploadPostImage({
  file,
  onProgress,
  token,
}: UploadImageOptions): Promise<UploadedImage> {
  const formData = new FormData();
  formData.set('image', file);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('POST', buildApiUrl('/uploads/images'));
    request.setRequestHeader('Authorization', `Bearer ${token}`);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onerror = () => {
      reject(new Error('Image upload failed because the network request failed.'));
    };

    request.onload = () => {
      const body = readJsonBody(request.responseText);

      if (request.status < 200 || request.status >= 300) {
        reject(
          new ApiError(
            readErrorMessage(body, `Image upload failed with status ${request.status}`),
            request.status,
            body,
          ),
        );
        return;
      }

      const response = body as UploadImageResponse;

      if (!response.image?.key) {
        reject(new Error('Image upload response did not include an image key.'));
        return;
      }

      onProgress?.(100);
      resolve(response.image);
    };

    request.send(formData);
  });
}

export async function createPost(
  apiClient: ApiClient,
  input: CreatePostInput,
): Promise<Post> {
  const response = await apiClient.request<CreatePostResponse>('/posts', {
    body: input,
    method: 'POST',
  });

  return response.post;
}

export async function getPost(apiClient: ApiClient, postId: string): Promise<Post> {
  const response = await apiClient.request<GetPostResponse>(
    `/posts/${encodeURIComponent(postId)}`,
  );

  return response.post;
}

export async function likePost(
  apiClient: ApiClient,
  postId: string,
): Promise<LikePostResponse> {
  return apiClient.request<LikePostResponse>(
    `/posts/${encodeURIComponent(postId)}/like`,
    {
      method: 'POST',
    },
  );
}

export async function unlikePost(
  apiClient: ApiClient,
  postId: string,
): Promise<LikePostResponse> {
  return apiClient.request<LikePostResponse>(
    `/posts/${encodeURIComponent(postId)}/like`,
    {
      method: 'DELETE',
    },
  );
}

export async function listPostComments(
  apiClient: ApiClient,
  postId: string,
): Promise<ListCommentsResponse> {
  return apiClient.request<ListCommentsResponse>(
    `/posts/${encodeURIComponent(postId)}/comments`,
  );
}

export async function createPostComment(
  apiClient: ApiClient,
  postId: string,
  input: CreateCommentInput,
): Promise<CreateCommentResponse> {
  return apiClient.request<CreateCommentResponse>(
    `/posts/${encodeURIComponent(postId)}/comments`,
    {
      body: input,
      method: 'POST',
    },
  );
}

export async function getFeedPage(
  apiClient: ApiClient,
  options: GetFeedPageOptions = {},
): Promise<FeedPage> {
  const searchParams = new URLSearchParams();

  if (options.cursor) {
    searchParams.set('cursor', options.cursor);
  }

  if (options.limit !== undefined) {
    searchParams.set('limit', String(options.limit));
  }

  const queryString = searchParams.toString();

  return apiClient.request<FeedPage>(queryString ? `/feed?${queryString}` : '/feed');
}
