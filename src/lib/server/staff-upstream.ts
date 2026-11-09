/**
 * One bounded request to the backend for the staff proxy: it either returns the response (headers AND body) within the
 * deadline or throws. The deadline is an AbortController driven by a plain timer that this function owns and clears.
 *
 * Why not `AbortSignal.timeout()` inside `AbortSignal.any()`: Node keeps the sources of an `any()` signal only weakly, so
 * after a garbage collection the timeout can silently never fire and the request hangs until the browser's own limit
 * (reproduced on Node 23: an `any([..., timeout(1000)])` request still pending after 3s). A timer we hold does not have
 * that problem. `AbortSignal.timeout()` alone is fine (the customer BFF uses it that way).
 */

export interface BoundedFetchOptions {
  timeoutMs: number;
  /** The browser's own request signal: if the browser goes away the backend request is cancelled too. */
  signal?: AbortSignal;
  /** Statuses that must not carry a body (204/205/304): the body is not read for them. */
  noBodyStatuses?: ReadonlySet<number>;
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}

export async function fetchBounded(url: string, init: RequestInit, options: BoundedFetchOptions): Promise<{ response: Response; data: ArrayBuffer | null }> {
  const fetchFn = options.fetchFn ?? ((u, i) => fetch(u, i));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), options.timeoutMs);
  const onClientAbort = () => controller.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) onClientAbort();
    else options.signal.addEventListener('abort', onClientAbort, { once: true });
  }
  try {
    const response = await fetchFn(url, { ...init, signal: controller.signal });
    // The deadline also covers reading the body, so a response that stalls after its headers cannot hang the proxy.
    const data = options.noBodyStatuses?.has(response.status) ? null : await response.arrayBuffer();
    return { response, data };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onClientAbort);
  }
}
