"use client";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./model";

type ResourceState<T> = {
  load: () => Promise<T>;
  revision: number;
  data: T | null;
  error: string;
};

export function getResourceSnapshot<T>(
  state: ResourceState<T> | null,
  load: () => Promise<T>,
  revision: number,
) {
  // A changed loader is a different resource, so never expose the previous id.
  const current = state?.load === load ? state : null;
  const pending = current === null || current.revision !== revision;
  const data = current?.data ?? null;
  const hasData = data !== null;
  return {
    data,
    loading: !hasData && pending,
    refreshing: hasData && pending,
    error: !hasData && !pending ? current?.error ?? "" : "",
    refreshError: hasData ? current?.error ?? "" : "",
  };
}

export function retainResourceDataOnFailure<T>(
  previous: ResourceState<T> | null,
  load: () => Promise<T>,
  revision: number,
  error: string,
): ResourceState<T> {
  return {
    load,
    revision,
    data: previous?.load === load ? previous.data : null,
    error,
  };
}

export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<ResourceState<T> | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(load)
      .then((data) => {
        if (!cancelled) setState({ load, revision, data, error: "" });
      })
      .catch((error) => {
        if (!cancelled) {
          setState((previous) =>
            retainResourceDataOnFailure(previous, load, revision, errorMessage(error)),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load, revision]);
  return { ...getResourceSnapshot(state, load, revision), retry };
}
