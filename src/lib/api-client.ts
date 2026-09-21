/** The browser talks only to the same-origin application API. */
export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code = "request_failed", public readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  identityScoped?: boolean;
};

const activeRequests = new Set<AbortController>();
let identityGeneration = 0;

/** Call before clearing/switching account data so late responses cannot restore it. */
export function invalidateApiRequests() {
  identityGeneration++;
  for (const controller of activeRequests) controller.abort();
  activeRequests.clear();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith("/api/") || path.includes("\\")) throw new Error("Invalid application API path.");
  const controller = new AbortController();
  const generation = identityGeneration;
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();
  const timer = setTimeout(() => controller.abort(new Error("Request timed out. Please retry.")), options.timeoutMs ?? 20_000);
  if (options.identityScoped !== false) activeRequests.add(controller);
  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });
    if (options.identityScoped !== false && generation !== identityGeneration) throw new DOMException("Account changed", "AbortError");
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) throw new ApiError("The service returned an unexpected response. Please retry.", response.status || 502, "invalid_response");
    const payload: unknown = await response.json();
    if (options.identityScoped !== false && generation !== identityGeneration) throw new DOMException("Account changed", "AbortError");
    if (!response.ok) {
      const value = payload as { error?: string | { message?: string; code?: string; details?: unknown }; message?: string; code?: string; details?: unknown };
      const error = value?.error;
      throw new ApiError(typeof error === "string" ? error : error?.message ?? value?.message ?? "The request could not be completed.", response.status, typeof error === "object" ? error?.code : value?.code, typeof error === "object" ? error?.details : value?.details);
    }
    return payload as T;
  } finally {
    clearTimeout(timer);
    activeRequests.delete(controller);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

export function householdPath(householdId: string, resource: string, id?: string) {
  return `/api/households/${encodeURIComponent(householdId)}/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

/** Notify the active household poller after a confirmed write. */
export function requestDataRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pantry:data-refresh"));
}
