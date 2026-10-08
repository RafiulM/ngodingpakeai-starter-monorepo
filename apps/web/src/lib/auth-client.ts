import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { ac, roles } from "@starter/shared/permissions";
import { API_URL } from "@/lib/env";

// Talks to Better Auth on the Express API (a different origin), so every call
// carries cookies with credentials: "include". The API's CORS and Better
// Auth's trustedOrigins accept exactly this web origin.
//
// adminClient shares the access control, so authClient.admin.checkRolePermission
// can hide UI locally. It is a convenience only: the API checks every request.
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
  plugins: [adminClient({ ac, roles })],
});

export type Session = typeof authClient.$Infer.Session;
