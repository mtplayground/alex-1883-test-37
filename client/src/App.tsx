import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { CreatePostForm } from './components/CreatePostForm';
import { Header } from './components/Header';
import './styles.css';

export function App() {
  return (
    <>
      <Header />
      <main className="app-shell">
        <CreatePostForm />
      </main>
    </>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

createRoot(rootElement).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
