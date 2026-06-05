import { buildApiUrl } from '../api/client';
import { useAuth } from '../auth/AuthContext';

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'M';
}

function startGoogleSignIn(): void {
  window.location.assign(buildApiUrl('/auth/google'));
}

export function Header() {
  const { status, user } = useAuth();
  const isSignedIn = status === 'authenticated' && user;

  return (
    <header className="site-header">
      <a className="brand-mark" href="/" aria-label="myClawTeam home">
        myClawTeam
      </a>
      <div className="auth-slot">
        {isSignedIn ? (
          <div className="user-chip" aria-label={`Signed in as ${user.name}`}>
            {user.avatarUrl ? (
              <img className="user-avatar" src={user.avatarUrl} alt="" />
            ) : (
              <span className="user-avatar user-avatar-fallback">
                {getInitials(user.name)}
              </span>
            )}
            <span className="user-name">{user.name}</span>
          </div>
        ) : (
          <button
            className="sign-in-button"
            disabled={status === 'loading'}
            onClick={startGoogleSignIn}
            type="button"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
