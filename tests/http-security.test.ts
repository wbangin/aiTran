import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../src/providers/http';

afterEach(() => vi.unstubAllGlobals());
describe('API request security', () => {
  it('enforces no redirects or browser credentials even if callers request them', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await fetchWithRetry('https://example.com/api', { method: 'POST', redirect: 'follow', credentials: 'include', body: 'text' });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({
      redirect: 'error', credentials: 'omit', cache: 'no-store', body: 'text'
    }));
  });
});
