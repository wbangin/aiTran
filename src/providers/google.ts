import { AiTranError } from '../shared/errors';
import { toGoogleLanguage } from '../shared/language';
import type { ProviderTranslateRequest, ProviderTranslateResult, TranslationProvider } from '../shared/types';
import { fetchWithRetry, readJson } from './http';

const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/t';

function decodeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&#34;': '"',
    '&#38;': '&',
    '&#60;': '<',
    '&#62;': '>',
    '&#160;': ' '
  };
  return value.replace(/&(?:lt|gt|amp|quot|#39|#34|#38|#60|#62|#160);/gi, (match) => entities[match.toLowerCase()] ?? match);
}

export function parseGoogleTranslations(payload: unknown, expectedCount: number): string[] {
  if (!Array.isArray(payload)) throw new AiTranError('Google Translate returned an unexpected response', 'INVALID_RESPONSE');

  const direct = payload.map((entry) => {
    if (typeof entry === 'string') return entry;
    if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
    return undefined;
  });

  if (direct.length === expectedCount && direct.every((entry): entry is string => typeof entry === 'string')) {
    return direct.map(decodeHtml);
  }

  if (expectedCount === 1 && Array.isArray(payload[0])) {
    const parts = (payload[0] as unknown[])
      .map((entry) => (Array.isArray(entry) && typeof entry[0] === 'string' ? entry[0] : ''))
      .filter(Boolean);
    if (parts.length) return [decodeHtml(parts.join(''))];
  }

  throw new AiTranError(
    `Google Translate returned ${direct.filter(Boolean).length} results for ${expectedCount} texts`,
    'INVALID_RESPONSE'
  );
}

export class GoogleProvider implements TranslationProvider {
  readonly id = 'google' as const;
  readonly name = 'Google Translate';

  async translate(request: ProviderTranslateRequest): Promise<ProviderTranslateResult> {
    if (!request.texts.length) return { translations: [] };

    const query = new URLSearchParams({
      client: 'gtx',
      dt: 't',
      sl: toGoogleLanguage(request.sourceLanguage),
      tl: toGoogleLanguage(request.targetLanguage)
    });
    const body = new URLSearchParams();
    request.texts.forEach((text) => body.append('q', text));

    const response = await fetchWithRetry(
      `${GOOGLE_TRANSLATE_URL}?${query.toString()}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body
      },
      { signal: request.signal }
    );
    const payload = await readJson(response);
    return { translations: parseGoogleTranslations(payload, request.texts.length) };
  }
}
