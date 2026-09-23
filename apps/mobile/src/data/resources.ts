import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./auth-provider";

export const endpoint = (area: string, id?: string) =>
  `/api/sunday-school/${area}${id ? `/${encodeURIComponent(id)}` : ""}`;
export function query(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.toString();
}
export function request<T>(path: string, method = "GET", body?: unknown) {
  if (!api) return Promise.reject(new Error("The portal is not configured."));
  return api.request<T>(path, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
}
// Fetch on focus, discard obsolete responses, and never retain privileged data
// after a failed permission check or a switch to a different record.
export function useResource<T>(path: string | null) {
  const sequence = useRef(0);
  const [state, setState] = useState<{ path: string | null; data?: T; loading: boolean; error?: string }>({ path, loading: !!path });
  const refresh = useCallback(async () => {
    const version = ++sequence.current;
    if (!path) { setState({ path, loading: false }); return; }
    setState({ path, loading: true });
    try {
      const data = await request<T>(path);
      if (sequence.current === version) setState({ path, data, loading: false });
    } catch (error) {
      if (sequence.current === version) setState({ path, loading: false, error: error instanceof Error ? error.message : "Unable to load. Please retry." });
    }
  }, [path]);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { sequence.current++; };
  }, [refresh]));
  return { ...(state.path === path ? state : { path, data: undefined, error: undefined, loading: !!path }), refresh };
}
