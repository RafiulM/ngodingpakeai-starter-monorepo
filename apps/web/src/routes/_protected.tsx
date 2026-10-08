import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { roleHasPermission } from "@starter/shared/permissions";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

// Pathless layout for signed-in screens. The check runs on the server during
// SSR and again on client navigation. It protects pages only: the API
// authenticates every request itself.
export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/sign-in" });
    return { session: context.session };
  },
  component: ProtectedLayout,
});

const navLink =
  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[status=active]:bg-muted data-[status=active]:text-foreground";

function ProtectedLayout() {
  const { user } = Route.useRouteContext().session;
  // Presentation only; /admin guards itself and the API enforces the role.
  const canAdmin = roleHasPermission(user.role, { notes: ["read-any"] });

  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <div className="flex flex-wrap items-center gap-6">
            <Brand />
            <nav aria-label="Main" className="flex gap-1">
              <Link to="/app" className={navLink}>
                App
              </Link>
              <Link to="/notes" className={navLink}>
                Notes
              </Link>
              {canAdmin && (
                <Link to="/admin" className={navLink}>
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16"
      >
        <Outlet />
      </main>
    </>
  );
}
