import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import {
  createPostComment,
  likePost,
  listPostComments,
  unlikePost,
  type PostComment,
} from '../api/posts';
import { useAuth } from '../auth/AuthContext';

const MAX_COMMENT_BODY_LENGTH = 1000;

export type PostActivityProps = {
  initialCommentCount?: number | undefined;
  initialLikeCount?: number | undefined;
  initiallyLikedByViewer?: boolean | undefined;
  postId: string;
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

function formatCommentDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function CommentRow({ comment }: { comment: PostComment }) {
  const commentDate = useMemo(
    () => formatCommentDate(comment.createdAt),
    [comment.createdAt],
  );

  return (
    <li className="comment-row">
      {comment.author.avatarUrl ? (
        <img className="comment-avatar" src={comment.author.avatarUrl} alt="" />
      ) : (
        <span className="comment-avatar comment-avatar-fallback">
          {getInitials(comment.author.name)}
        </span>
      )}
      <div className="comment-copy">
        <div className="comment-meta">
          <span className="comment-author">{comment.author.name}</span>
          <time dateTime={comment.createdAt}>{commentDate}</time>
        </div>
        <p className="comment-body">{comment.body}</p>
      </div>
    </li>
  );
}

export function PostActivity({
  initialCommentCount = 0,
  initialLikeCount = 0,
  initiallyLikedByViewer = false,
  postId,
}: PostActivityProps) {
  const { apiClient, status } = useAuth();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState('');
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [likedByViewer, setLikedByViewer] = useState(initiallyLikedByViewer);
  const [likeCount, setLikeCount] = useState(initialLikeCount);

  const commentsQuery = useQuery({
    queryFn: () => listPostComments(apiClient, postId),
    queryKey: ['post-comments', postId],
  });

  const comments = commentsQuery.data?.comments ?? [];
  const displayedCommentCount = commentsQuery.data?.commentCount ?? commentCount;
  const remainingCharacters = MAX_COMMENT_BODY_LENGTH - commentBody.length;
  const canSubmitComment =
    status === 'authenticated' &&
    commentBody.trim().length > 0 &&
    commentBody.length <= MAX_COMMENT_BODY_LENGTH;

  const likeMutation = useMutation({
    mutationFn: () =>
      likedByViewer ? unlikePost(apiClient, postId) : likePost(apiClient, postId),
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
    onSuccess: (response) => {
      setErrorMessage(null);
      setLikeCount(response.likeCount);
      setLikedByViewer(response.likedByViewer);
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => createPostComment(apiClient, postId, { body }),
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
    onSuccess: (response) => {
      setCommentBody('');
      setCommentCount(response.commentCount);
      setErrorMessage(null);
      queryClient.setQueryData<Awaited<ReturnType<typeof listPostComments>>>(
        ['post-comments', postId],
        (currentData) => ({
          commentCount: response.commentCount,
          comments: currentData?.comments.some(
            (comment) => comment.id === response.comment.id,
          )
            ? currentData.comments
            : [...(currentData?.comments ?? []), response.comment],
          postId,
        }),
      );
    },
  });

  function handleLikeClick() {
    if (status !== 'authenticated') {
      setErrorMessage('Sign in to like posts.');
      return;
    }

    likeMutation.mutate();
  }

  function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status !== 'authenticated') {
      setErrorMessage('Sign in to comment.');
      return;
    }

    const body = commentBody.trim();

    if (!body || commentBody.length > MAX_COMMENT_BODY_LENGTH) {
      setErrorMessage(
        `Comment must be between 1 and ${MAX_COMMENT_BODY_LENGTH} characters.`,
      );
      return;
    }

    commentMutation.mutate(body);
  }

  return (
    <section className="post-activity" aria-label="Post activity">
      <div className="post-activity-summary">
        <button
          type="button"
          className={likedByViewer ? 'like-button like-button-active' : 'like-button'}
          disabled={likeMutation.isPending || status === 'loading'}
          onClick={handleLikeClick}
        >
          {likedByViewer ? 'Liked' : 'Like'}
        </button>
        <span>{likeCount} likes</span>
        <span>{displayedCommentCount} comments</span>
      </div>

      {errorMessage ? (
        <p className="activity-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="comment-list-shell" aria-live="polite">
        {commentsQuery.isLoading ? (
          <p className="comment-empty">Loading comments</p>
        ) : commentsQuery.isError ? (
          <p className="activity-error">
            {commentsQuery.error instanceof Error
              ? commentsQuery.error.message
              : 'Unable to load comments.'}
          </p>
        ) : comments.length > 0 ? (
          <ul className="comment-list">
            {comments.map((comment) => (
              <CommentRow key={comment.id} comment={comment} />
            ))}
          </ul>
        ) : (
          <p className="comment-empty">No comments yet.</p>
        )}
      </div>

      <form className="comment-form" onSubmit={handleCommentSubmit}>
        <label className="field-label" htmlFor={`comment-${postId}`}>
          Comment
        </label>
        <textarea
          id={`comment-${postId}`}
          className="comment-input"
          value={commentBody}
          disabled={commentMutation.isPending || status !== 'authenticated'}
          maxLength={MAX_COMMENT_BODY_LENGTH}
          onChange={(event) => {
            setCommentBody(event.target.value);
            setErrorMessage(null);
          }}
          placeholder={
            status === 'authenticated' ? 'Add a comment' : 'Sign in to comment'
          }
        />
        <div className="comment-form-footer">
          <span
            className={
              remainingCharacters < 0 ? 'comment-count invalid' : 'comment-count'
            }
          >
            {remainingCharacters}
          </span>
          <button
            type="submit"
            className="primary-button comment-submit"
            disabled={!canSubmitComment || commentMutation.isPending}
          >
            Post
          </button>
        </div>
      </form>
    </section>
  );
}
