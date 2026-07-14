const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

let _accessToken: string | null = null;
let _refreshCallback: (() => Promise<boolean>) | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function setRefreshCallback(fn: (() => Promise<boolean>) | null): void {
  _refreshCallback = fn;
}

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  skipRetry = false,
): Promise<T> {
  const buildHeaders = (token: string | null): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(_accessToken),
  });

  if (res.status === 401 && !skipRetry && _refreshCallback) {
    const ok = await _refreshCallback();
    if (ok) {
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(_accessToken),
      });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { message?: string }).message ?? `HTTP ${res.status}`,
      res.status,
    );
  }

  const json = (await res.json()) as { data?: unknown };
  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
