import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const store = {
  get: (k: string, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/** Session cookie is HttpOnly and sent automatically; the custom header is the CSRF defence the server requires. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method: opts.method ?? "GET",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-requested-with": "tpc" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event("tpc:unauthorized"));
    throw new ApiError(r.status, j.error ?? `Request failed (${r.status})`);
  }
  return j as T;
}

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!path) return;
    try { setData(await api<T>(path)); setError(null); } catch (e) { setError(e as ApiError); } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { setLoading(true); void load(); }, [load]);
  return { data, error, loading, reload: load };
}
