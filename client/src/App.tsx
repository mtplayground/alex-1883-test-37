import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { CreatePostForm } from './components/CreatePostForm';
import { FeedPage } from './components/FeedPage';
import { Header } from './components/Header';
import { PostDetailView } from './components/PostDetailView';
import { ProfilePage } from './components/ProfilePage';
import './styles.css';

const queryClient = new QueryClient();

function readPostIdFromPath(pathname: string): string | null {
  const match = /^\/posts\/([^/]+)\/?$/.exec(pathname);

  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

function readUserIdFromPath(pathname: string): string | null {
  const match = /^\/users\/([^/]+)\/?$/.exec(pathname);

  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

export function App() {
  const isCreatePath = /^\/create\/?$/.test(window.location.pathname);
  const postId = readPostIdFromPath(window.location.pathname);
  const profileUserId = readUserIdFromPath(window.location.pathname);

  return (
    <>
      <Header />
      <main className="app-shell">
        {profileUserId ? (
          <ProfilePage key={profileUserId} userId={profileUserId} />
        ) : postId ? (
          <PostDetailView key={postId} postId={postId} />
        ) : isCreatePath ? (
          <CreatePostForm />
        ) : (
          <FeedPage />
        )}
      </main>
    </>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>,
);
