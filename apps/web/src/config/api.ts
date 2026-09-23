const origin = import.meta.env.VITE_API_URL ?? "";

export const API_URL = `${origin.replace(/\/+$/, "")}/api`;
