const ACCESS_TOKEN_KEY = 'myclawteam.accessToken';

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function readStoredAccessToken(): string | null {
  if (!hasLocalStorage()) {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(accessToken: string): void {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearStoredAccessToken(): void {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}
