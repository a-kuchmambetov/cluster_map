import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./app";
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/features/auth/api", () => ({ getSession }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.mocked(getSession).mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

it.each([
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms of Service"],
])(
  "keeps %s readable while authentication is pending or unavailable",
  async (path, title) => {
    let rejectSession!: (reason: Error) => void;
    vi.mocked(getSession).mockReturnValue(
      new Promise((_, reject) => {
        rejectSession = reject;
      }),
    );
    window.history.replaceState({}, "", path);
    await act(async () => root.render(<App />));
    expect(container.querySelector("h1")?.textContent).toBe(title);
    expect(document.title).toBe(`${title} | Cluster Map`);
    await act(async () => rejectSession(new Error("API unavailable")));
    expect(container.querySelector("h1")?.textContent).toBe(title);
    expect(window.location.pathname).toBe(path);
    expect(container.querySelector('footer a[href="/privacy"]')).not.toBeNull();
    expect(container.querySelector('footer a[href="/terms"]')).not.toBeNull();
    for (const anchor of container.querySelectorAll<HTMLAnchorElement>(
      'a[href^="#"]',
    )) {
      expect(container.querySelector(anchor.hash)).not.toBeNull();
    }
  },
);
