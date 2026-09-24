import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router";
import { Dataflow03, LogOut01, Users01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { useAuth } from "./auth-provider";

const navigationClassName = ({ isActive }: { isActive: boolean }) =>
  cx(
    "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold outline-cluster-free transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
    isActive
      ? "bg-cluster-accent text-cluster-accent-text hover:bg-cluster-accent-hover"
      : "text-tertiary hover:bg-cluster-accent-soft hover:text-cluster-free-text",
  );

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    setError("");
    try {
      await auth.signOut();
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  if (auth.status === "anonymous" || auth.status === "two-factor")
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`}
        replace
      />
    );
  if (auth.status === "loading")
    return (
      <main className="p-6" role="status">
        Checking your session...
      </main>
    );
  if (auth.status === "error" || auth.status === "forbidden")
    return (
      <main className="space-y-4 p-6">
        <h1>
          {auth.status === "forbidden"
            ? "Your account does not have access."
            : "Unable to check your session."}
        </h1>
        <Button onClick={auth.refresh}>Try again</Button>
        {auth.status === "forbidden" && (
          <Button onClick={signOut} isDisabled={busy}>
            Sign out
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
      </main>
    );
  return (
    <>
      <header className="border-b border-cluster-border bg-cluster-surface/95">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="Cluster Map home"
            className="flex shrink-0 items-center gap-2.5 rounded-lg outline-cluster-free focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0"
            />
            <span className="text-md font-semibold tracking-tight text-primary sm:text-lg">
              Cluster Map
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="order-last flex w-full items-center gap-1 rounded-xl border border-cluster-border bg-cluster-surface-soft p-1 *:flex-1 md:order-none md:w-auto md:*:flex-none"
          >
            <NavLink to="/" end className={navigationClassName}>
              <Dataflow03 aria-hidden="true" className="size-4 shrink-0" />
              Cluster map
            </NavLink>
            <NavLink to="/settings/security" className={navigationClassName}>
              Security
            </NavLink>
            {auth.user?.role === "admin" && (
              <NavLink to="/admin/users" className={navigationClassName}>
                <Users01 aria-hidden="true" className="size-4 shrink-0" />
                Users
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="hidden min-w-0 items-center gap-3 sm:flex">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-secondary bg-tertiary text-xs font-semibold text-secondary"
              >
                {auth.user?.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="hidden min-w-0 lg:block">
                <p
                  className="max-w-48 truncate text-sm font-medium text-primary"
                  title={auth.user?.name}
                >
                  {auth.user?.name}
                </p>
                <p className="text-xs text-tertiary">
                  {auth.user?.role === "admin" ? "Administrator" : "Member"}
                </p>
              </div>
              <span className="sr-only lg:hidden">{auth.user?.name}</span>
            </div>
            <Button
              color="tertiary"
              iconLeading={LogOut01}
              onClick={signOut}
              isDisabled={busy}
              isLoading={busy}
              aria-label="Sign out"
            >
              Sign out
            </Button>
          </div>
        </div>
        {error && (
          <div className="mx-auto max-w-[1280px] px-4 pb-4 sm:px-6 lg:px-8">
            <p
              role="alert"
              className="rounded-lg bg-error-primary px-4 py-3 text-sm text-error-primary"
            >
              {error}
            </p>
          </div>
        )}
      </header>
      <Outlet />
    </>
  );
}
