import { Link, Navigate, useSearchParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import GitHub from "@/components/foundations/social-icons/github";
import { API_URL } from "@/config/api";
import { useAuth } from "./auth-provider";

export function safeReturnPath(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    Array.from(value).some((char) => char === "\\" || char.charCodeAt(0) <= 32)
  )
    return "/";
  const pathname = value.split(/[?#]/)[0];
  return pathname === "/login" ? "/" : value;
}
export function AuthScreen() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const githubError =
    params.get("error") === "github_access_denied"
      ? "Your account does not have access yet. Ask an administrator to approve your account, then sign in again."
      : params.get("error") === "github_sign_in_failed"
        ? "GitHub sign-in failed. Please try again."
        : "";
  if (auth.status === "authenticated")
    return <Navigate to={safeReturnPath(params.get("returnTo"))} replace />;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12 text-primary">
      <div>
        <div className="mb-2 flex items-center gap-2.5 text-sm text-tertiary">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0"
          />
          <span>Cluster Map</span>
        </div>
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-tertiary">
          Sign in with GitHub to view the cluster map. New accounts need
          administrator approval before they can see it.
        </p>
        <p className="mt-3 text-sm leading-6 text-tertiary">
          Read our{" "}
          <Link className="underline" to="/privacy">
            Privacy Policy
          </Link>
          {" and "}
          <Link className="underline" to="/terms">
            Terms of Service
          </Link>
          {" before signing in."}
        </p>
      </div>
      {githubError && (
        <p role="alert" className="text-sm text-error-primary">
          {githubError}
        </p>
      )}
      <Button
        color="secondary"
        iconLeading={<GitHub aria-hidden="true" data-icon="leading" />}
        onClick={() => {
          // OAuth must reach the server, bypassing client-side routing.
          window.location.assign(
            `${API_URL}/auth/sign-in/github?${new URLSearchParams({
              callbackURL: `${window.location.origin}${safeReturnPath(params.get("returnTo"))}`,
            })}`,
          );
        }}
      >
        Sign in with GitHub
      </Button>
    </main>
  );
}
