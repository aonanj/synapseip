const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FetchWithRetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  retryStatusCodes?: number[];
  maxRetryableAttemptMs?: number;
};

const DEFAULT_RETRYABLE_STATUS = [500];
// Transient failures (dropped connections) come back fast; a slow failure is likely deterministic, e.g. a timeout.
const DEFAULT_MAX_RETRYABLE_ATTEMPT_MS = 5_000;

export async function fetchWithRetry(
  requestFn: () => Promise<Response>,
  {
    retries = 2,
    retryDelayMs = 0,
    retryStatusCodes = DEFAULT_RETRYABLE_STATUS,
    maxRetryableAttemptMs = DEFAULT_MAX_RETRYABLE_ATTEMPT_MS,
  }: FetchWithRetryOptions = {}
): Promise<Response> {
  let lastError: unknown = undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await requestFn();
      const retryable =
        retryStatusCodes.includes(response.status) && Date.now() - startedAt < maxRetryableAttemptMs;
      if (!retryable || attempt === retries) {
        return response;
      }
    } catch (err) {
      lastError = err;
      if (attempt === retries || Date.now() - startedAt >= maxRetryableAttemptMs) {
        throw err;
      }
    }

    if (retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }
  }

  throw lastError ?? new Error("fetchWithRetry exhausted retries without a response");
}
