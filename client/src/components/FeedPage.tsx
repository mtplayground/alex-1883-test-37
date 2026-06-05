import { useEffect, useMemo, useState } from 'react';
import { getFeedPage, type Post } from '../api/posts';
import { useAuth } from '../auth/AuthContext';

type FeedStatus = 'error' | 'loading' | 'ready';

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

function PostCard({ post }: { post: Post }) {
  const postDate = useMemo(() => formatPostDate(post.createdAt), [post.createdAt]);
  const likeCount = 0;
  const commentCount = 0;

  return (
    <article className="feed-card">
      <a className="feed-card-media" href={`/posts/${encodeURIComponent(post.id)}`}>
        {post.imageUrl ? (
          <img className="feed-card-image" src={post.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="feed-card-image-missing" />
        )}
      </a>

      <div className="feed-card-body">
        <div className="feed-card-author-row">
          {post.author.avatarUrl ? (
            <img className="feed-card-avatar" src={post.author.avatarUrl} alt="" />
          ) : (
            <span className="feed-card-avatar feed-card-avatar-fallback">
              {getInitials(post.author.name)}
            </span>
          )}
          <div className="feed-card-author-copy">
            <span className="feed-card-author-name">{post.author.name}</span>
            <time dateTime={post.createdAt}>{postDate}</time>
          </div>
        </div>

        {post.caption ? (
          <p className="feed-card-caption">{post.caption}</p>
        ) : (
          <p className="feed-card-caption feed-card-caption-empty">No caption</p>
        )}

        <div className="feed-card-summary" aria-label="Post activity">
          <span>{likeCount} likes</span>
          <span>{commentCount} comments</span>
        </div>
      </div>
    </article>
  );
}

export function FeedPage() {
  const { apiClient, status } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('loading');
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let isActive = true;

    getFeedPage(apiClient)
      .then((feedPage) => {
        if (!isActive) {
          return;
        }

        setPosts(feedPage.posts);
        setFeedStatus('ready');
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load feed.',
        );
        setFeedStatus('error');
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, status]);

  if (status === 'loading') {
    return (
      <section className="feed-surface" aria-live="polite">
        <div className="feed-list">
          <div className="feed-placeholder" />
          <div className="feed-placeholder" />
        </div>
      </section>
    );
  }

  if (status !== 'authenticated') {
    return (
      <section className="feed-surface">
        <div className="feed-message">
          <p className="eyebrow">myClawTeam</p>
          <h1>Feed</h1>
          <p>Sign in to see your feed.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="feed-surface" aria-labelledby="feed-title">
      <div className="feed-heading">
        <div>
          <p className="eyebrow">myClawTeam</p>
          <h1 id="feed-title">Feed</h1>
        </div>
        <a className="primary-link-button" href="/create">
          Create
        </a>
      </div>

      {feedStatus === 'loading' ? (
        <div className="feed-list" aria-live="polite">
          <div className="feed-placeholder" />
          <div className="feed-placeholder" />
        </div>
      ) : null}

      {feedStatus === 'error' ? (
        <div className="feed-message">
          <h1>Feed unavailable</h1>
          <p>{errorMessage ?? 'Unable to load feed.'}</p>
        </div>
      ) : null}

      {feedStatus === 'ready' && posts.length === 0 ? (
        <div className="feed-message">
          <h1>No posts yet</h1>
          <p>Your feed is empty.</p>
        </div>
      ) : null}

      {feedStatus === 'ready' && posts.length > 0 ? (
        <div className="feed-list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
