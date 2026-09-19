import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { useAuth } from "./auth-provider";
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
  if (auth.status === "authenticated")
    return <Navigate to={safeReturnPath(params.get("returnTo"))} replace />;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12 text-primary">
      <div>
        <p className="mb-2 text-sm text-tertiary">Cluster Map</p>
        <h1 className="text-3xl font-semibold">
          {registration ? "Request an account" : "Sign in"}
        </h1>
        <p className="mt-2 text-tertiary">
          {registration
            ? "Accounts require administrator approval before signing in."
            : "Sign in to view the cluster map."}
        </p>
      </div>
      {message ? (
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
      <Link
        className="underline"
        to={`${registration ? "/login" : "/register"}${params.get("returnTo") ? `?returnTo=${encodeURIComponent(safeReturnPath(params.get("returnTo")))}` : ""}`}
      >
        {registration ? "Back to sign in" : "Request an account"}
      </Link>
    </main>
  );
}
