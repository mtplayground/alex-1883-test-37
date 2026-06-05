const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly body: unknown;
  readonly status: number;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.body = body;
    this.status = status;
  }
}

export type ApiClientOptions = {
  getAccessToken?: () => string | null;
};

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') ?? false;
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  if (isJsonResponse(response)) {
    return response.json();
  }

  return response.text();
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }

  return fallback;
}

export class ApiClient {
  private readonly getAccessToken: (() => string | null) | undefined;

  constructor(options: ApiClientOptions = {}) {
    this.getAccessToken = options.getAccessToken;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { body: requestBody, ...requestOptions } = options;
    const headers = new Headers(options.headers);
    const token = this.getAccessToken?.();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let body: BodyInit | undefined;

    if (requestBody !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(requestBody);
    }

    const requestInit: RequestInit = {
      ...requestOptions,
      headers,
    };

    if (body !== undefined) {
      requestInit.body = body;
    }

    const response = await fetch(buildUrl(path), requestInit);
    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(responseBody, `Request failed with status ${response.status}`),
        response.status,
        responseBody,
      );
    }

    return responseBody as T;
  }
}
