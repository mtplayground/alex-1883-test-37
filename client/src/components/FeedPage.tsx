import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { getFeedPage, type FeedPage as FeedPageData, type Post } from '../api/posts';
import { useAuth } from '../auth/AuthContext';
import { PostActivity } from './PostActivity';

const FEED_PAGE_LIMIT = 10;

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
        <a
          className="feed-card-author-row"
          href={`/users/${encodeURIComponent(post.author.id)}`}
        >
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
        </a>

        {post.caption ? (
          <p className="feed-card-caption">{post.caption}</p>
        ) : (
          <p className="feed-card-caption feed-card-caption-empty">No caption</p>
        )}

        <PostActivity
          initialCommentCount={post.commentCount}
          initialLikeCount={post.likeCount}
          initiallyLikedByViewer={post.likedByViewer}
          postId={post.id}
        />
      </div>
    </article>
  );
}

export function FeedPage() {
  const { apiClient, status } = useAuth();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const feedQuery = useInfiniteQuery<
    FeedPageData,
    Error,
    InfiniteData<FeedPageData>,
    ['feed', string],
    string | null
  >({
    enabled: status === 'authenticated',
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getFeedPage(apiClient, {
        cursor: pageParam,
        limit: FEED_PAGE_LIMIT,
      }),
    queryKey: ['feed', status],
  });
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    isSuccess,
  } = feedQuery;
  const posts = useMemo(() => data?.pages.flatMap((page) => page.posts) ?? [], [data]);

  useEffect(() => {
    const loadMoreElement = loadMoreRef.current;

    if (!loadMoreElement || !hasNextPage || isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: '480px 0px' },
    );

    observer.observe(loadMoreElement);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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

      {isLoading ? (
        <div className="feed-list" aria-live="polite">
          <div className="feed-placeholder" />
          <div className="feed-placeholder" />
        </div>
      ) : null}

      {isError ? (
        <div className="feed-message">
          <h1>Feed unavailable</h1>
          <p>{error instanceof Error ? error.message : 'Unable to load feed.'}</p>
        </div>
      ) : null}

      {isSuccess && posts.length === 0 ? (
        <div className="feed-message">
          <h1>No posts yet</h1>
          <p>Your feed is empty.</p>
        </div>
      ) : null}

      {isSuccess && posts.length > 0 ? (
        <div className="feed-list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <div ref={loadMoreRef} className="feed-load-sentinel">
            {isFetchingNextPage ? 'Loading more' : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
