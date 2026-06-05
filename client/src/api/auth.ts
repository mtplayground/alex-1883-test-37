import type { ApiClient } from './client';

export type CurrentUser = {
  avatarUrl: string | null;
  email: string;
  googleId: string;
  id: string;
  name: string;
};

export type AuthSession = {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: CurrentUser;
};

type CurrentUserResponse = {
  user: CurrentUser;
};

export async function getCurrentUser(apiClient: ApiClient): Promise<CurrentUser> {
  const response = await apiClient.request<CurrentUserResponse>('/me');

  return response.user;
}
