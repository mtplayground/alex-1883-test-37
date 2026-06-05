import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { getPost, type Post } from '../api/posts';
import { useAuth } from '../auth/AuthContext';

export type PostDetailViewProps = {
  postId: string | null;
};

type PostDetailStatus = 'error' | 'loading' | 'ready';

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'M';
}

function formatPostDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function PostDetailView({ postId }: PostDetailViewProps) {
  const { apiClient } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [status, setStatus] = useState<PostDetailStatus>('loading');

  const postDate = useMemo(
    () => (post ? formatPostDate(post.createdAt) : null),
    [post],
  );

  useEffect(() => {
    if (!postId) {
      return;
    }

    let isActive = true;

    getPost(apiClient, postId)
      .then((nextPost) => {
        if (!isActive) {
          return;
        }

        setPost(nextPost);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError && error.status === 404
            ? 'Post was not found.'
            : error instanceof Error
              ? error.message
              : 'Unable to load post.',
        );
        setStatus('error');
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, postId]);

  if (!postId) {
    return (
      <section className="post-detail-surface">
        <div className="post-detail-message">
          <p className="eyebrow">myClawTeam</p>
          <h1>Post unavailable</h1>
          <p>Post ID is missing.</p>
        </div>
      </section>
    );
  }

  if (status === 'loading') {
    return (
      <section className="post-detail-surface" aria-live="polite">
        <div className="post-detail-placeholder" />
      </section>
    );
  }

  if (status === 'error' || !post) {
    return (
      <section className="post-detail-surface">
        <div className="post-detail-message">
          <p className="eyebrow">myClawTeam</p>
          <h1>Post unavailable</h1>
          <p>{errorMessage ?? 'Unable to load post.'}</p>
        </div>
      </section>
    );
  }

  return (
    <article className="post-detail-surface">
      <div className="post-detail-media">
        {post.imageUrl ? (
          <img className="post-detail-image" src={post.imageUrl} alt="" />
        ) : (
          <div className="post-detail-image-missing" />
        )}
      </div>

      <div className="post-detail-body">
        <div className="post-author-row">
          {post.author.avatarUrl ? (
            <img className="post-author-avatar" src={post.author.avatarUrl} alt="" />
          ) : (
            <span className="post-author-avatar post-author-avatar-fallback">
              {getInitials(post.author.name)}
            </span>
          )}
          <div className="post-author-copy">
            <span className="post-author-name">{post.author.name}</span>
            {postDate ? <time dateTime={post.createdAt}>{postDate}</time> : null}
          </div>
        </div>

        {post.caption ? (
          <p className="post-caption">{post.caption}</p>
        ) : (
          <p className="post-caption post-caption-empty">No caption</p>
        )}
      </div>
    </article>
  );
}
