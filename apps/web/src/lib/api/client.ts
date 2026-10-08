import { createIsomorphicFn } from "@tanstack/react-start";
import type { ApiErrorBody } from "@starter/shared/types";
import { API_URL } from "@/lib/env";
import {
  apiBaseUrl,
  forwardedHeaders,
  logUpstreamFailure,
} from "@/lib/api/upstream.server";

// A failed API call, carrying the API's error envelope.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ApiErrorBody["error"]["details"],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

type FailureLogger = (
  path: string,
  detail: { status?: number; err?: unknown },
) => void;

type ApiRequest = {
  method?: Method;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

// Where and how to call the API from the current environment. The .server()
// branch (and its server-only imports) is compiled out of the browser bundle;
// keep server-only names out of the .client() branch, even in types.
// - Browser: the public API origin, with the visitor's cookies.
// - Server (SSR loaders, e.g. queryClient.ensureQueryData during render): the
//   internal API origin, forwarding the visitor's cookie and request ID.
// Only GETs run on the server; mutations come from the browser, which sends
// the Origin header the API's CSRF check requires.
const target = createIsomorphicFn()
  .server(() => ({
    baseUrl: apiBaseUrl(),
    headers: forwardedHeaders(),
    onFailure: logUpstreamFailure as FailureLogger,
  }))
  .client(() => ({
    baseUrl: API_URL,
    headers: {} as Record<string, string>,
    onFailure: (() => {}) as FailureLogger,
  }));

export async function apiFetch<T>(
  path: string,
  { method = "GET", query, body, signal }: ApiRequest = {},
): Promise<T> {
  const { baseUrl, headers, onFailure } = target();
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query ?? {}))
    if (value !== undefined) url.searchParams.set(key, String(value));

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      credentials: "include",
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    onFailure(path, { err });
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "We couldn't reach the server. Check your connection and try again.",
    );
  }

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as
    (T & Partial<ApiErrorBody>) | null;
  if (!response.ok) {
    onFailure(path, { status: response.status });
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "HTTP_ERROR",
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.details,
    );
  }
  return payload as T;
}
