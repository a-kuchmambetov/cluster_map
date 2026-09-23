import { API_URL } from "@/config/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const listeners = new Set<(status: number) => void>();
export function onAccessDenied(listener: (status: number) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  notify = true,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (
      notify &&
      !options.signal?.aborted &&
      (response.status === 401 || response.status === 403)
    )
      listeners.forEach((listener) => listener(response.status));
    throw new ApiError(
      response.status,
      body?.error?.message ??
        body?.message ??
        `Request failed (${response.status})`,
    );
  }
  return response.json();
}
