import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import GitHub from "@/components/foundations/social-icons/github";
import { API_URL } from "@/config/api";
import { useAuth } from "./auth-provider";
import { TOTPForm } from "./totp-form";
import { register } from "./api";

export function safeReturnPath(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    Array.from(value).some((char) => char === "\\" || char.charCodeAt(0) <= 32)
  )
    return "/";
  const pathname = value.split(/[?#]/)[0];
  return pathname === "/login" || pathname === "/register" ? "/" : value;
}
export function AuthScreen({
  registration = false,
}: {
  registration?: boolean;
}) {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const challenge = auth.status === "two-factor";
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
        <h1 className="text-3xl font-semibold">
          {challenge
            ? "Two-factor authentication"
            : registration
              ? "Request an account"
              : "Sign in"}
        </h1>
        <p className="mt-2 text-tertiary">
          {challenge
            ? "Enter the 6-digit code from your authenticator app to finish signing in."
            : registration
              ? "Accounts require administrator approval before signing in."
              : "Sign in to view the cluster map."}
        </p>
      </div>
      {!challenge && githubError && (
        <p role="alert" className="text-sm text-error-primary">
          {githubError}
        </p>
      )}
      {!registration && !challenge && (
        <>
          <Button
            color="secondary"
            iconLeading={<GitHub aria-hidden="true" data-icon="leading" />}
            isDisabled={busy}
            href={`${API_URL}/auth/sign-in/github?${new URLSearchParams({
              callbackURL: `${window.location.origin}${safeReturnPath(params.get("returnTo"))}`,
            })}`}
          >
            Sign in with GitHub
          </Button>
          <div className="flex items-center gap-3 text-sm text-tertiary">
            <span className="h-px flex-1 bg-border-secondary" />
            <span>or sign in with email</span>
            <span className="h-px flex-1 bg-border-secondary" />
          </div>
        </>
      )}
      {challenge ? (
        <TOTPForm
          allowTrust
          onVerify={auth.verifyTwoFactor}
          onCancel={auth.cancelTwoFactor}
        />
      ) : message ? (
        <p role="status">{message}</p>
      ) : (
        <Form
          className="flex flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const data = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              const email = String(data.get("email")).trim();
              const password = String(data.get("password"));
              if (registration)
                setMessage(
                  (
                    await register(
                      String(data.get("name")).trim(),
                      email,
                      password,
                    )
                  ).message,
                );
              else await auth.signIn(email, password);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Unable to connect. Try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {registration && (
            <Input
              label="Name"
              name="name"
              autoComplete="name"
              isRequired
              maxLength={200}
            />
          )}
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            isRequired
            maxLength={254}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete={registration ? "new-password" : "current-password"}
            isRequired
            minLength={8}
            maxLength={128}
          />
          {error && (
            <p role="alert" className="text-sm text-error-primary">
              {error}
            </p>
          )}
          <Button type="submit" isDisabled={busy} isLoading={busy}>
            {registration ? "Request account" : "Sign in"}
          </Button>
        </Form>
      )}
      {!challenge && (
        <Link
          className="underline"
          to={`${registration ? "/login" : "/register"}${params.get("returnTo") ? `?returnTo=${encodeURIComponent(safeReturnPath(params.get("returnTo")))}` : ""}`}
        >
          {registration ? "Back to sign in" : "Request an account"}
        </Link>
      )}
    </main>
  );
}
