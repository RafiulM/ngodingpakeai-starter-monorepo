import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";
import {
  getResponseHeader,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { ac, roles } from "@starter/shared/permissions";
import {
  apiBaseUrl,
  forwardedHeaders,
  logUpstreamFailure,
} from "@/lib/api/upstream.server";

// A server-side Better Auth client pointed at the API's internal address.
// Same plugins as the browser client, so the session type matches.
const serverAuthClient = createAuthClient({
  baseURL: apiBaseUrl(),
  plugins: [adminClient({ ac, roles })],
});

export type Session = typeof serverAuthClient.$Infer.Session;

// The current visitor's session, read from the API with their own cookie.
// The cookie set by the API also reaches this server: in development because
// cookies ignore ports (localhost:4000 → localhost:3000), in production through
// COOKIE_DOMAIN (api.example.com → app.example.com).
export async function fetchSession(): Promise<Session | null> {
  const headers = forwardedHeaders();
  if (!headers.cookie) return null;
  try {
    const { data, error } = await serverAuthClient.getSession({
      query: { disableCookieCache: true },
      fetchOptions: {
        headers,
        // Better Auth may refresh the session cookie on read. Relay it to the
        // browser, which would otherwise only get it on its next direct call.
        onResponse: ({ response }) => {
          const cookies = response.headers.getSetCookie();
          if (!cookies.length) return;
          const existing = getResponseHeader("set-cookie");
          setResponseHeader("set-cookie", [
            ...(existing ? [existing] : []),
            ...cookies,
          ]);
        },
      },
    });
    if (error) {
      logUpstreamFailure("/api/auth/get-session", { status: error.status });
      return null;
    }
    return data;
  } catch (err) {
    // The API is down or unreachable. Render signed-out rather than crash.
    logUpstreamFailure("/api/auth/get-session", { err });
    return null;
  }
}
