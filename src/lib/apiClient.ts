const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
}

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export async function apiJson<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = buildApiUrl(path);
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (err) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ApiRequestError(
        'You appear to be offline. Please check your mobile data or Wi-Fi connection and try again.',
        0
      );
    }
    const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
    throw new ApiRequestError(
      `Unable to reach the server API${detail}. Please try again in a moment.`,
      0
    );
  }

  const rawText = await response.text();
  let parsed: Record<string, unknown> | null = null;

  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
      throw new ApiRequestError(parsed.error.trim(), response.status);
    }
    if (response.status === 404) {
      throw new ApiRequestError(
        `API endpoint not found (${path} returned HTTP 404). Verify backend API routes are deployed.`,
        404
      );
    }
    if (response.status === 405) {
      throw new ApiRequestError(
        `Method not allowed on ${path} (HTTP 405). Verify Vercel /api/ rewrite is active.`,
        405
      );
    }
    const snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    throw new ApiRequestError(
      `Server error (HTTP ${response.status})${snippet ? `: ${snippet}` : '.'}`,
      response.status
    );
  }

  if (!parsed) {
    throw new ApiRequestError(
      `Unexpected non-JSON response from ${path} (HTTP ${response.status}).`,
      response.status
    );
  }

  return parsed as T;
}
