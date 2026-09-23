"use client";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./model";

export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{
    data: T | null;
    error: string;
    loading: boolean;
  }>({ data: null, error: "", loading: true });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ data, error: "", loading: false });
      })
      .catch((error) => {
        if (!cancelled)
          setState({ data: null, error: errorMessage(error), loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [load, revision]);
  return { ...state, retry };
}
