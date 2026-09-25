import { AiTranError } from './errors';

export function validateCustomProviderUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AiTranError('自定义服务 URL 无效', 'INVALID_CUSTOM_URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AiTranError('自定义服务只支持 HTTP 或 HTTPS URL', 'INVALID_CUSTOM_URL');
  }
  if (parsed.username || parsed.password) {
    throw new AiTranError('服务 URL 不可包含账号或密码，请在 API Key 字段填写密钥', 'INVALID_CUSTOM_URL');
  }
  // Match the parsed host exactly; a suffix or private LAN host is not loopback.
  const loopback = parsed.hostname === 'localhost' || parsed.hostname === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(parsed.hostname);
  if (parsed.protocol === 'http:' && !loopback) {
    throw new AiTranError('公网及局域网自定义服务必须使用 HTTPS URL；HTTP 仅允许 localhost、127.0.0.0/8 或 [::1] 本机地址', 'INVALID_CUSTOM_URL');
  }
  return parsed;
}

/** Accept a provider base URL or a complete endpoint without guessing its API version. */
export function resolveChatCompletionsUrl(value: string): URL {
  const url = validateCustomProviderUrl(value.trim());
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return url;
}
