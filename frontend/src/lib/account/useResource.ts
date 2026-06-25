"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/apiClient";

// Client data hook for the account section. Fetches a backend resource with the
// Neon Auth Bearer token attached (via apiGet → apiFetch). Pass null to skip.
//
// Follows the repo's fetch-in-effect convention (see useGeocodeSearch): the effect
// only calls setState *after* the await, never synchronously, and the transient
// loading/stale state is derived during render — so there are no cascading renders.

export type Resource<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
};

export function useResource<T>(path: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await apiGet<T>(path);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setData(null);
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoadedPath(path);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(async () => {
    setTick((t) => t + 1);
  }, []);

  // Derived: while the loaded path lags the requested one, show loading (not the
  // previous path's data/error).
  const stale = loadedPath !== path;
  return {
    data: stale ? null : data,
    error: stale ? null : error,
    loading: path !== null && stale,
    reload,
  };
}
