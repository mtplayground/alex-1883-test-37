import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_CAPTION_LENGTH,
  MAX_IMAGE_BYTES,
  createPost,
  uploadPostImage,
  type Post,
} from '../api/posts';
import { useAuth } from '../auth/AuthContext';

type SubmitState = 'creating' | 'idle' | 'uploading';

function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);

  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function validateImageFile(file: File): string | undefined {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Choose a GIF, JPEG, PNG, or WebP image.';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return `Choose an image ${formatFileSize(MAX_IMAGE_BYTES)} or smaller.`;
  }

  return undefined;
}

export function CreatePostForm() {
  const { apiClient, status, token, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdPost, setCreatedPost] = useState<Post | null>(null);

  const trimmedCaption = caption.trim();
  const captionCharactersRemaining = MAX_CAPTION_LENGTH - caption.length;
  const isAuthenticated = status === 'authenticated' && Boolean(user) && Boolean(token);
  const isSubmitting = submitState !== 'idle';
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const validationMessage = useMemo(() => {
    if (!isAuthenticated) {
      return 'Sign in before creating a post.';
    }

    if (!file) {
      return 'Choose an image before posting.';
    }

    if (fileError) {
      return fileError;
    }

    if (caption.length > MAX_CAPTION_LENGTH) {
      return `Caption must be ${MAX_CAPTION_LENGTH} characters or fewer.`;
    }

    return undefined;
  }, [caption.length, file, fileError, isAuthenticated]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextFile = event.target.files?.[0] ?? null;
    setCreatedPost(null);
    setFormMessage(null);
    setUploadProgress(0);

    if (!nextFile) {
      setFile(null);
      setFileError(null);
      return;
    }

    const nextFileError = validateImageFile(nextFile);
    setFile(nextFile);
    setFileError(nextFileError ?? null);
  }

  function clearSelectedImage(): void {
    setFile(null);
    setFileError(null);
    setFormMessage(null);
    setUploadProgress(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreatedPost(null);
    setFormMessage(null);

    if (validationMessage || !file || !token) {
      setFormMessage(validationMessage ?? 'Unable to create post.');
      return;
    }

    setSubmitState('uploading');
    setUploadProgress(0);

    try {
      const uploadedImage = await uploadPostImage({
        file,
        onProgress: setUploadProgress,
        token,
      });

      setSubmitState('creating');

      const post = await createPost(apiClient, {
        caption: trimmedCaption || null,
        imageKey: uploadedImage.key,
      });

      setCreatedPost(post);
      setCaption('');
      setFormMessage('Post created.');
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Unable to create post.');
    } finally {
      setSubmitState('idle');
    }
  }

  return (
    <section className="create-post-surface" aria-labelledby="create-post-title">
      <div className="create-post-heading">
        <p className="eyebrow">myClawTeam</p>
        <h1 id="create-post-title">Create a post</h1>
      </div>

      <form className="create-post-form" onSubmit={handleSubmit}>
        <div className="image-field">
          <label className="field-label" htmlFor="post-image">
            Image
          </label>
          <input
            ref={fileInputRef}
            accept="image/gif,image/jpeg,image/png,image/webp"
            className="image-input"
            disabled={isSubmitting}
            id="post-image"
            onChange={handleImageChange}
            type="file"
          />
          {previewUrl ? (
            <div className="image-preview-shell">
              <img className="image-preview" src={previewUrl} alt="" />
              <button
                className="secondary-button"
                disabled={isSubmitting}
                onClick={clearSelectedImage}
                type="button"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="empty-preview" aria-hidden="true" />
          )}
          {file ? (
            <p className="field-note">
              {file.name} · {formatFileSize(file.size)}
            </p>
          ) : null}
          {fileError ? <p className="field-error">{fileError}</p> : null}
        </div>

        <div className="caption-field">
          <label className="field-label" htmlFor="post-caption">
            Caption
          </label>
          <textarea
            className="caption-input"
            disabled={isSubmitting}
            id="post-caption"
            maxLength={MAX_CAPTION_LENGTH + 1}
            onChange={(event) => {
              setCaption(event.target.value);
              setCreatedPost(null);
              setFormMessage(null);
            }}
            rows={5}
            value={caption}
          />
          <p className={captionCharactersRemaining < 0 ? 'field-error' : 'field-note'}>
            {Math.max(captionCharactersRemaining, 0)} characters remaining
          </p>
        </div>

        {isSubmitting ? (
          <div className="upload-progress" aria-live="polite">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${submitState === 'creating' ? 100 : uploadProgress}%`,
                }}
              />
            </div>
            <span>
              {submitState === 'uploading'
                ? `Uploading ${uploadProgress}%`
                : 'Creating post'}
            </span>
          </div>
        ) : null}

        {formMessage ? (
          <p className={createdPost ? 'form-success' : 'form-error'}>{formMessage}</p>
        ) : null}

        <button
          className="primary-button"
          disabled={isSubmitting || Boolean(validationMessage)}
          type="submit"
        >
          {isSubmitting ? 'Posting' : 'Post'}
        </button>
      </form>
    </section>
  );
}
