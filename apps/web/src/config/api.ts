// Use the same origin by default; Vite proxies /api during local development.
const apiOrigin = (import.meta.env.VITE_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

export const API_BASE_URL = `${apiOrigin}/api`;
