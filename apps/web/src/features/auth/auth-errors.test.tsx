import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth-provider";
import { AuthScreen } from "./auth-screen";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
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

it.each([
  [false, 401, "Invalid email or password"],
  [false, 429, "Too many authentication attempts. Try again later."],
  [true, 429, "Too many authentication attempts. Try again later."],
  [false, 403, "Your account is awaiting administrator approval."],
] as const)(
  "shows API errors on the auth form (registration=%s, status=%s)",
  async (registration, status, message) => {
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) =>
      Response.json(
        {
          ok: false,
          error:
            options?.method === "POST" ? message : "Authentication required",
        },
        { status: options?.method === "POST" ? status : 401 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AuthProvider>
            <AuthScreen registration={registration} />
          </AuthProvider>
        </MemoryRouter>,
      );
    });
    container.querySelector<HTMLInputElement>('[name="email"]')!.value =
      "person@example.com";
    container.querySelector<HTMLInputElement>('[name="password"]')!.value =
      "wrong-password";
    if (registration)
      container.querySelector<HTMLInputElement>('[name="name"]')!.value =
        "Person";
    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(registration ? "/auth/register" : "/auth/login"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      message,
    );
    expect(container.textContent).not.toContain("Request failed");
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!
        .disabled,
    ).toBe(false);
  },
);
