// ─── Retry wrapper ────────────────────────────────────
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  backoffMs: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

// ─── HTTP client with timeout ─────────────────────────
export async function httpGet<T>(
  url: string,
  timeoutMs: number
): Promise<{ success: true; data: T; latencyMs: number } | { success: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const response = await fetch(url, { signal: controller.signal });
    const latencyMs = performance.now() - start;

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data, latencyMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
