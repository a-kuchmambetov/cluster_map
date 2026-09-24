import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { SecurityScreen } from "./security-screen";
import * as api from "./api";

const auth = vi.hoisted(() => ({
  user: { twoFactorEnabled: false },
  refresh: vi.fn(),
  setTwoFactorEnabled: vi.fn(),
}));
vi.mock("./auth-provider", () => ({ useAuth: () => auth }));
vi.mock("./api", () => ({
  enableTwoFactor: vi.fn(),
  disableTwoFactor: vi.fn(),
  verifyTOTP: vi.fn(),
}));
vi.mock("@/components/shared-assets/qr-code", () => ({
  QRCode: ({ value }: { value: string }) => <span data-qr={value} />,
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  auth.user.twoFactorEnabled = false;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => root.render(<SecurityScreen />));
}
async function submit(name: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(
    `input[name="${name}"]`,
  )!;
  input.value = value;
  await act(async () => {
    input.form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}
it("requires verification before enabling and retains backup codes until acknowledged", async () => {
  vi.mocked(api.enableTwoFactor).mockResolvedValue({
    totpURI: "otpauth://totp/Cluster?secret=SECRET",
    backupCodes: ["backup-one", "backup-two"],
  });
  await render();
  await submit("password", "password123");
  expect(api.enableTwoFactor).toHaveBeenCalledWith("password123");
  expect(container.textContent).toContain("Setup in progress");
  expect(container.textContent).toContain("SECRET");
  expect(container.textContent).toContain("backup-one");
  vi.mocked(api.verifyTOTP).mockRejectedValueOnce(new Error("Invalid code"));
  await submit("code", "123456");
  expect(container.textContent).toContain("Invalid code");
  expect(container.textContent).toContain("Setup in progress");
  await submit("code", "654321");
  expect(container.textContent).toContain(
    "Two-factor authentication is enabled.",
  );
  expect(container.textContent).toContain("backup-two");
  expect(container.querySelector("[data-qr]")).toBeNull();
  expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(
    true,
  );
  await act(async () =>
    container
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .click(),
  );
  await act(async () =>
    container.querySelector<HTMLButtonElement>("button")!.click(),
  );
  expect(auth.refresh).toHaveBeenCalled();
  expect(container.textContent).not.toContain("backup-one");
});
it("keeps 2FA enabled when disabling fails and allows retry", async () => {
  auth.user.twoFactorEnabled = true;
  vi.mocked(api.disableTwoFactor).mockRejectedValueOnce(
    new Error("Incorrect password"),
  );
  await render();
  await submit("password", "wrong");
  expect(container.textContent).toContain("Incorrect password");
  expect(container.textContent).toContain("Enabled");
  vi.mocked(api.disableTwoFactor).mockResolvedValue({ status: true });
  await submit("password", "correct");
  expect(api.disableTwoFactor).toHaveBeenLastCalledWith("correct");
  expect(container.textContent).toContain(
    "Two-factor authentication is disabled.",
  );
});
