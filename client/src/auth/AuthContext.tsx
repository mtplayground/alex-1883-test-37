import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getCurrentUser, type AuthSession, type CurrentUser } from '../api/auth';
import { ApiClient } from '../api/client';
import {
  clearStoredAccessToken,
  readStoredAccessToken,
  storeAccessToken,
} from './tokenStorage';

type AuthStatus = 'anonymous' | 'authenticated' | 'loading';

export type AuthContextValue = {
  apiClient: ApiClient;
  refreshCurrentUser: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  signOut: () => void;
  status: AuthStatus;
  token: string | null;
  user: CurrentUser | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() => readStoredAccessToken());
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    token ? 'loading' : 'anonymous',
  );

  const apiClient = useMemo(
    () =>
      new ApiClient({
        getAccessToken: () => token,
      }),
    [token],
  );

  const signOut = useCallback(() => {
    clearStoredAccessToken();
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const storedToken = readStoredAccessToken();

    if (!storedToken) {
      signOut();
      return;
    }

    setStatus('loading');

    try {
      const authenticatedUser = await getCurrentUser(apiClient);
      setToken(storedToken);
      setUser(authenticatedUser);
      setStatus('authenticated');
    } catch {
      signOut();
    }
  }, [apiClient, signOut]);

  const setSession = useCallback((session: AuthSession) => {
    storeAccessToken(session.accessToken);
    setToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let isActive = true;

    getCurrentUser(apiClient)
      .then((authenticatedUser) => {
        if (!isActive) {
          return;
        }

        setUser(authenticatedUser);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        signOut();
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, signOut, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      apiClient,
      refreshCurrentUser,
      setSession,
      signOut,
      status,
      token,
      user,
    }),
    [apiClient, refreshCurrentUser, setSession, signOut, status, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
