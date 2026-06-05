import type { CurrentUser } from './auth';
import type { ApiClient } from './client';
import type { Post } from './posts';

export type ProfileUser = Pick<CurrentUser, 'avatarUrl' | 'email' | 'id' | 'name'> & {
  createdAt: string;
};

export type FollowSummary = {
  followedByViewer: boolean;
  followerCount: number;
  followingCount: number;
  userId: string;
};

export type UserProfile = FollowSummary & {
  postCount: number;
  user: ProfileUser;
};

export type UserProfileResponse = {
  posts: Post[];
  profile: UserProfile;
};

export async function getUserProfile(
  apiClient: ApiClient,
  userId: string,
): Promise<UserProfileResponse> {
  return apiClient.request<UserProfileResponse>(
    `/users/${encodeURIComponent(userId)}/profile`,
  );
}

export async function followUser(
  apiClient: ApiClient,
  userId: string,
): Promise<FollowSummary> {
  return apiClient.request<FollowSummary>(
    `/users/${encodeURIComponent(userId)}/follow`,
    {
      method: 'POST',
    },
  );
}

export async function unfollowUser(
  apiClient: ApiClient,
  userId: string,
): Promise<FollowSummary> {
  return apiClient.request<FollowSummary>(
    `/users/${encodeURIComponent(userId)}/follow`,
    {
      method: 'DELETE',
    },
  );
}
