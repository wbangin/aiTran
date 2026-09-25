import { describe, expect, it } from 'vitest';
import { resolveChatCompletionsUrl, validateCustomProviderUrl } from '../src/shared/provider-url';

describe('custom API transport policy', () => {
  it.each(['https://example.com/api', 'https://192.168.1.2/api', 'http://localhost:8080/api', 'http://127.0.0.1:8080', 'http://127.1.2.3/api', 'http://[::1]:8080/api'])('allows HTTPS and loopback only: %s', (url) => {
    expect(validateCustomProviderUrl(url).href).toBe(new URL(url).href);
  });
  it.each(['http://example.com/api', 'http://192.168.1.2/api', 'http://10.0.0.1/api', 'http://0.0.0.0/api', 'http://localhost.example.com/api', 'http://127.0.0.1.example.com/api', 'http://[::ffff:127.0.0.1]/api'])('rejects remote HTTP without echoing the URL: %s', (url) => {
    expect(() => validateCustomProviderUrl(url)).toThrow('必须使用 HTTPS');
  });
  it.each(['https://user:secret@example.com/api', 'http://user:secret@localhost/api'])('rejects URL credentials: %s', (url) => {
    expect(() => validateCustomProviderUrl(url)).toThrow('不可包含账号或密码');
  });
});

describe('Chat Completions URL completion', () => {
  it.each([
    ['https://ark.cn-beijing.volces.com/api/coding/v3', 'https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions'],
    ['https://example.com/v1', 'https://example.com/v1/chat/completions'],
    ['https://example.com/api/v3/', 'https://example.com/api/v3/chat/completions'],
    ['https://example.com/proxy/v2///', 'https://example.com/proxy/v2/chat/completions'],
    ['https://example.com', 'https://example.com/chat/completions'],
    ['http://127.0.0.1:8080/', 'http://127.0.0.1:8080/chat/completions'],
    ['  https://example.com/v1/  ', 'https://example.com/v1/chat/completions'],
    ['https://example.com/v1/chat/completions', 'https://example.com/v1/chat/completions'],
    ['https://example.com/v1/chat/completions///', 'https://example.com/v1/chat/completions'],
    ['https://example.com/v1/?api-version=2026-01&value=a%2Fb#section', 'https://example.com/v1/chat/completions?api-version=2026-01&value=a%2Fb#section'],
    ['https://example.com/v1/chat/completions?api-version=2026-01', 'https://example.com/v1/chat/completions?api-version=2026-01']
  ])('completes %s without duplicating the endpoint', (input, expected) => {
    const completed = resolveChatCompletionsUrl(input).href;
    expect(completed).toBe(expected);
    expect(resolveChatCompletionsUrl(completed).href).toBe(expected);
  });

  it.each(['', '/v1', 'not a URL', 'file:///tmp/api', 'ftp://example.com/api', 'javascript:alert(1)'])('rejects invalid or unsupported URL %s', (input) => {
    expect(() => resolveChatCompletionsUrl(input)).toThrow(/URL/);
  });
});
