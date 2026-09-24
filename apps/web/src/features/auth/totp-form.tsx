import { useState } from "react";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";

export function TOTPForm({
  onVerify,
  onCancel,
  allowTrust = false,
}: {
  onVerify: (code: string, trustDevice: boolean) => Promise<void>;
  onCancel?: () => void;
  allowTrust?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Form
      className="flex flex-col gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const data = new FormData(event.currentTarget);
        const code = String(data.get("code")).trim();
        if (!/^\d{6}$/.test(code)) {
          setError("Enter the 6-digit code from your authenticator app.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          await onVerify(code, data.get("trustDevice") === "on");
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to verify. Try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input
        label="Authentication code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        isRequired
        minLength={6}
        maxLength={6}
        isDisabled={busy}
      />
      {allowTrust && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="trustDevice" disabled={busy} />
          Trust this device
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-error-primary">
          {error}
        </p>
      )}
      <Button type="submit" isDisabled={busy} isLoading={busy}>
        Verify code
      </Button>
      {onCancel && (
        <Button
          type="button"
          color="secondary"
          onClick={onCancel}
          isDisabled={busy}
        >
          Back to sign in
        </Button>
      )}
    </Form>
  );
}
