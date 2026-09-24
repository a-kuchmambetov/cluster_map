import { useState } from "react";
import type { TwoFactorSetupResponse } from "@repo/types";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { QRCode } from "@/components/shared-assets/qr-code";
import { useAuth } from "./auth-provider";
import { enableTwoFactor, disableTwoFactor, verifyTOTP } from "./api";
import { TOTPForm } from "./totp-form";

const qrOptions = { width: 240, height: 240, margin: 8 };

export function SecurityScreen() {
  const auth = useAuth();
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [enabled, setEnabled] = useState(auth.user?.twoFactorEnabled ?? false);
  const [verified, setVerified] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10 text-primary">
      <div>
        <h1 className="text-3xl font-semibold">Security</h1>
        <h2 className="mt-6 text-xl font-semibold">
          Two-factor authentication
        </h2>
        <p className="mt-2 text-tertiary">
          Protect your account with codes from an authenticator app.
        </p>
        <p className="mt-2 font-medium">
          {enabled ? "Enabled" : setup ? "Setup in progress" : "Not enabled"}
        </p>
      </div>
      {message && <p role="status">{message}</p>}
      {setup ? (
        <>
          {!verified && (
            <>
              <p>
                Scan this QR code with your authenticator app, or enter the
                setup key manually.
              </p>
              <div
                className="self-center"
                role="img"
                aria-label="Authenticator setup QR code"
              >
                <QRCode value={setup.totpURI} size="lg" options={qrOptions} />
              </div>
              <div>
                <p className="text-sm text-tertiary">Setup key</p>
                <code className="break-all select-all">
                  {new URL(setup.totpURI).searchParams.get("secret")}
                </code>
              </div>
            </>
          )}
          <div className="rounded-xl border border-secondary p-4">
            <h3 className="font-semibold">Save your backup codes</h3>
            <p className="mt-2 text-sm text-tertiary">
              Keep these codes somewhere safe outside this browser. They will
              not be shown again.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm select-all">
              {setup.backupCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
          {!verified ? (
            <TOTPForm
              onVerify={async (code) => {
                await verifyTOTP(code);
                setEnabled(true);
                auth.setTwoFactorEnabled(true);
                setVerified(true);
                setMessage("Two-factor authentication is enabled.");
              }}
            />
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(event) => setSaved(event.target.checked)}
                />
                I have saved my backup codes
              </label>
              <Button
                isDisabled={!saved}
                onClick={() => {
                  setSetup(null);
                  auth.refresh();
                }}
              >
                Done
              </Button>
            </>
          )}
        </>
      ) : (
        <Form
          key={String(enabled)}
          className="flex flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const form = event.currentTarget;
            const password = String(new FormData(form).get("password"));
            setBusy(true);
            setError("");
            setMessage("");
            try {
              if (enabled) {
                await disableTwoFactor(password);
                setEnabled(false);
                auth.setTwoFactorEnabled(false);
                setMessage("Two-factor authentication is disabled.");
              } else {
                setSetup(await enableTwoFactor(password));
                setVerified(false);
                setSaved(false);
              }
              form.reset();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Unable to update two-factor authentication. Try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-tertiary">
            {enabled
              ? "Enter your password to disable two-factor authentication. Signing in will only require your password."
              : "Enter your password to set up an authenticator app."}
          </p>
          <Input
            label="Current password"
            name="password"
            type="password"
            autoComplete="current-password"
            isRequired
            isDisabled={busy}
          />
          {error && (
            <p role="alert" className="text-sm text-error-primary">
              {error}
            </p>
          )}
          <Button type="submit" isDisabled={busy} isLoading={busy}>
            {enabled
              ? "Disable two-factor authentication"
              : "Set up two-factor authentication"}
          </Button>
        </Form>
      )}
    </main>
  );
}
