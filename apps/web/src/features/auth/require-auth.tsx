import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { useAuth } from "./auth-provider";
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
  if (auth.status === "anonymous")
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
      <header className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 pt-4">
        <span className="text-sm text-tertiary">{auth.user?.name}</span>
        <Button onClick={signOut} isDisabled={busy}>
          Sign out
        </Button>
        {error && <p role="alert">{error}</p>}
      </header>
      <Outlet />
    </>
  );
}
