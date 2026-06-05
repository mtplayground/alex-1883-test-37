import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import {
  followUser,
  getUserProfile,
  unfollowUser,
  type UserProfileResponse,
} from '../api/users';
import { useAuth } from '../auth/AuthContext';

export type ProfilePageProps = {
  userId: string | null;
};

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'M';
}

function formatJoinDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function ProfilePage({ userId }: ProfilePageProps) {
  const { apiClient, status, user: viewer } = useAuth();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const profileQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => getUserProfile(apiClient, userId ?? ''),
    queryKey: ['profile', userId],
  });
  const profileData = profileQuery.data;
  const isOwnProfile = Boolean(viewer && profileData?.profile.user.id === viewer.id);
  const joinedDate = useMemo(
    () =>
      profileData ? formatJoinDate(profileData.profile.user.createdAt) : undefined,
    [profileData],
  );

  const followMutation = useMutation({
    mutationFn: () => {
      if (!userId || !profileData) {
        throw new Error('Profile is not ready.');
      }

      return profileData.profile.followedByViewer
        ? unfollowUser(apiClient, userId)
        : followUser(apiClient, userId);
    },
    onError: (error: Error) => {
      setMutationError(error.message);
    },
    onSuccess: (summary) => {
      setMutationError(null);
      queryClient.setQueryData<UserProfileResponse>(
        ['profile', userId],
        (currentData) =>
          currentData
            ? {
                ...currentData,
                profile: {
                  ...currentData.profile,
                  ...summary,
                },
              }
            : currentData,
      );
    },
  });

  function handleFollowClick() {
    if (status !== 'authenticated') {
      setMutationError('Sign in to follow profiles.');
      return;
    }

    followMutation.mutate();
  }

  if (!userId) {
    return (
      <section className="profile-surface">
        <div className="profile-message">
          <p className="eyebrow">myClawTeam</p>
          <h1>Profile unavailable</h1>
          <p>Profile ID is missing.</p>
        </div>
      </section>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <section className="profile-surface" aria-live="polite">
        <div className="profile-placeholder" />
      </section>
    );
  }

  if (profileQuery.isError || !profileData) {
    const errorMessage =
      profileQuery.error instanceof ApiError && profileQuery.error.status === 404
        ? 'Profile was not found.'
        : profileQuery.error instanceof Error
          ? profileQuery.error.message
          : 'Unable to load profile.';

    return (
      <section className="profile-surface">
        <div className="profile-message">
          <p className="eyebrow">myClawTeam</p>
          <h1>Profile unavailable</h1>
          <p>{errorMessage}</p>
        </div>
      </section>
    );
  }

  const { posts, profile } = profileData;
  const followButtonText = profile.followedByViewer ? 'Following' : 'Follow';

  return (
    <section className="profile-surface" aria-labelledby="profile-title">
      <header className="profile-header">
        {profile.user.avatarUrl ? (
          <img className="profile-avatar" src={profile.user.avatarUrl} alt="" />
        ) : (
          <span className="profile-avatar profile-avatar-fallback">
            {getInitials(profile.user.name)}
          </span>
        )}

        <div className="profile-heading-copy">
          <p className="eyebrow">myClawTeam</p>
          <h1 id="profile-title">{profile.user.name}</h1>
          <p>{profile.user.email}</p>
          {joinedDate ? (
            <time dateTime={profile.user.createdAt}>Joined {joinedDate}</time>
          ) : null}
        </div>

        <div className="profile-actions">
          {isOwnProfile ? (
            <span className="profile-self-label">Your profile</span>
          ) : (
            <button
              type="button"
              className={
                profile.followedByViewer
                  ? 'follow-button follow-button-active'
                  : 'follow-button'
              }
              disabled={followMutation.isPending || status === 'loading'}
              onClick={handleFollowClick}
            >
              {followButtonText}
            </button>
          )}
        </div>
      </header>

      <div className="profile-stats" aria-label="Profile stats">
        <span>
          <strong>{profile.postCount}</strong>
          posts
        </span>
        <span>
          <strong>{profile.followerCount}</strong>
          followers
        </span>
        <span>
          <strong>{profile.followingCount}</strong>
          following
        </span>
      </div>

      {mutationError ? (
        <p className="profile-error" role="alert">
          {mutationError}
        </p>
      ) : null}

      {posts.length > 0 ? (
        <div className="profile-post-grid">
          {posts.map((post) => (
            <a
              key={post.id}
              className="profile-post-tile"
              href={`/posts/${encodeURIComponent(post.id)}`}
              aria-label={post.caption ?? 'Open post'}
            >
              {post.imageUrl ? (
                <img src={post.imageUrl} alt="" loading="lazy" />
              ) : (
                <span className="profile-post-missing" />
              )}
              <span className="profile-post-overlay">
                <span>{post.likeCount ?? 0} likes</span>
                <span>{post.commentCount ?? 0} comments</span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="profile-message">
          <h1>No posts yet</h1>
          <p>This profile has no posts.</p>
        </div>
      )}
    </section>
  );
}
