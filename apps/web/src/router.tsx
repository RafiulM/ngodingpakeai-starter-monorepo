import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ApiError } from "@/lib/api/client";
import { routeTree } from "./routeTree.gen";

function Pending() {
  return (
    <div
      role="status"
      className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground"
    >
      Loading your app…
    </div>
  );
}

export function getRouter() {
  // A fresh QueryClient per router: during SSR that means per request, so one
  // visitor's cached data never leaks into another's render.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (401/403/404/422) will not fix themselves on retry.
        retry: (failureCount, error) =>
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) && failureCount < 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient, session: null },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Let TanStack Query decide freshness for preloaded data.
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: Pending,
  });

  // Provides QueryClientProvider, and dehydrates queries fetched during SSR so
  // the browser hydrates them instead of fetching again.
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
