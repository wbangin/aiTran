import { AiTranError } from '../shared/errors';

interface FetchOptions {
  retries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  options: FetchOptions = {}
): Promise<Response> {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 15_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort('timeout'), timeoutMs);
    const onAbort = () => timeoutController.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await fetch(input, {
        ...init,
        signal: timeoutController.signal,
        credentials: 'omit',
        cache: 'no-store'
      });

      if (response.ok) return response;

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      const body = await response.text().catch(() => '');
      const error = new AiTranError(
        `Translation request failed (${response.status})${body ? `: ${body.slice(0, 160)}` : ''}`,
        'HTTP_ERROR',
        retryable,
        response.status
      );
      if (!retryable || attempt === retries) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) throw new AiTranError('Translation cancelled', 'ABORTED');
      if (attempt === retries || (error instanceof AiTranError && !error.retryable)) throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
    }

    await delay(400 * 2 ** attempt + Math.floor(Math.random() * 150));
  }

  throw lastError instanceof Error ? lastError : new AiTranError('Translation request failed', 'NETWORK_ERROR', true);
}

export async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiTranError(`Translation service returned invalid JSON: ${text.slice(0, 160)}`, 'INVALID_JSON');
  }
}
