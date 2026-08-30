const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export abstract class BaseApiClient {
  protected abstract resource: string;

  private url(path: string): string {
    return `${API_BASE}/${this.resource}${path}`;
  }

  protected async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.url(path), {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Berth-Client': 'web',
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      const body = await res.text().catch(() => res.statusText);
      throw new ApiError(
        res.status,
        this.message(body, res.statusText, res.status, contentType),
      );
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  private message(
    body: string,
    fallback: string,
    status: number,
    contentType: string,
  ): string {
    try {
      const parsed = JSON.parse(body) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) return parsed.message.join(', ');
      if (parsed.message) return parsed.message;
    } catch {
      /* not JSON */
    }
    const trimmed = body.trim();
    const looksLikeHtml =
      contentType.includes('text/html') ||
      /^<!doctype html/i.test(trimmed) ||
      /^<html/i.test(trimmed);
    if (looksLikeHtml) {
      if ([502, 503, 504].includes(status)) {
        return 'Berth could not reach the API. Check that berth-server is running and that the UI proxy targets the active HTTP port.';
      }
      return `Request failed with ${status} ${fallback}`.trim();
    }
    return body || fallback;
  }

  protected get<T>(path = ''): Promise<T> {
    return this.request<T>(path);
  }

  protected post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}
