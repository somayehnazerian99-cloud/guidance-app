"use client";

/**
 * Client-side API helpers.
 *
 * Two problems these solve, both of which showed up as "the site hangs when I
 * click twice":
 *
 *   1. Concurrent identical requests. `apiRequest` keeps a map of in-flight
 *      calls keyed by method + url + body, so a double click reuses the pending
 *      promise instead of firing a second request. The resolved value is a
 *      plain object (never a `Response`), because a Response body can only be
 *      consumed once and both callers must be able to read it.
 *
 *   2. Repeat submits. `useAsyncSubmit` holds a ref-based lock, so a handler
 *      cannot start twice even if React re-renders between the click and the
 *      state update.
 */

import * as React from "react";

const inFlight = new Map();

function buildKey(url, options) {
  const method = (options?.method || "GET").toUpperCase();
  const body = typeof options?.body === "string" ? options.body : "";
  return `${method} ${url} ${body}`;
}

/**
 * Perform a JSON request and always resolve to a plain result object.
 *
 * @param {string} url
 * @param {{method?: string, body?: any, headers?: Record<string,string>, signal?: AbortSignal}} [options]
 * @returns {Promise<{ok: boolean, status: number, data: any, networkError?: boolean}>}
 */
export function apiRequest(url, options = {}) {
  const { method = "GET", body, headers, signal } = options;

  const init = {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    ...(body !== undefined
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
    ...(signal ? { signal } : {}),
  };

  const key = buildKey(url, init);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const response = await fetch(url, init);

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      // An aborted request is not a failure the user needs to hear about.
      if (error?.name === "AbortError") {
        return { ok: false, status: 0, data: null, aborted: true };
      }
      return { ok: false, status: 0, data: null, networkError: true };
    }
  })();

  inFlight.set(key, promise);

  // Clean up on both success and failure so the next identical call is fresh.
  promise.finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });

  return promise;
}

/** Exposed for tests and for diagnostics in the browser console. */
export function pendingRequestCount() {
  return inFlight.size;
}

/**
 * Wrap an async submit handler with a lock + loading flag.
 *
 * @param {(...args: any[]) => Promise<any>} action
 */
export function useAsyncSubmit(action) {
  const lockRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const [loading, setLoading] = React.useState(false);
  const actionRef = React.useRef(action);

  // Keep the latest handler without restarting the memoized `run`.
  React.useEffect(() => {
    actionRef.current = action;
  }, [action]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = React.useCallback(async (...args) => {
    if (lockRef.current) return undefined;
    lockRef.current = true;
    setLoading(true);

    try {
      return await actionRef.current(...args);
    } finally {
      lockRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  return { loading, run };
}
