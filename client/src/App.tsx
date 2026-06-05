import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { Header } from './components/Header';
import './styles.css';

export function App() {
  return (
    <>
      <Header />
      <main className="app-shell">
        <section className="intro">
          <p className="eyebrow">myClawTeam</p>
          <h1>Share and follow claw machine wins.</h1>
          <p>
            The frontend package is ready for the auth, posting, feed, and profile flows
            planned in the upcoming issues.
          </p>
        </section>
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
