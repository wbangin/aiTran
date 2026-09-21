import { AiTranError } from '../shared/errors';
import { toMicrosoftLanguage } from '../shared/language';
import type { ProviderTranslateRequest, ProviderTranslateResult, TranslationProvider } from '../shared/types';
import { fetchWithRetry, readJson } from './http';

const MICROSOFT_TRANSLATE_URL = 'https://edge.microsoft.com/translate/translatetext';

interface MicrosoftResult {
  detectedLanguage?: { language?: string };
  translations?: Array<{ text?: string; to?: string }>;
}

export function parseMicrosoftTranslations(payload: unknown, expectedCount: number): ProviderTranslateResult {
  if (!Array.isArray(payload) || payload.length !== expectedCount) {
    throw new AiTranError(
      `Microsoft Translate returned ${Array.isArray(payload) ? payload.length : 0} results for ${expectedCount} texts`,
      'INVALID_RESPONSE'
    );
  }

  const results = payload as MicrosoftResult[];
  const translations = results.map((result) => result.translations?.[0]?.text);
  if (!translations.every((text): text is string => typeof text === 'string')) {
    throw new AiTranError('Microsoft Translate returned an unexpected response', 'INVALID_RESPONSE');
  }

  return {
    translations,
    detectedLanguage: results[0]?.detectedLanguage?.language
  };
}

export class MicrosoftProvider implements TranslationProvider {
  readonly id = 'microsoft' as const;
  readonly name = 'Microsoft Translate';

  async translate(request: ProviderTranslateRequest): Promise<ProviderTranslateResult> {
    if (!request.texts.length) return { translations: [] };

    const url = new URL(MICROSOFT_TRANSLATE_URL);
    const source = toMicrosoftLanguage(request.sourceLanguage);
    if (source) url.searchParams.set('from', source);
    url.searchParams.set('to', toMicrosoftLanguage(request.targetLanguage));
    url.searchParams.set('isEnterpriseClient', 'false');

    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          accept: '*/*',
          'content-type': 'application/json'
        },
        body: JSON.stringify(request.texts)
      },
      { signal: request.signal }
    );
    const payload = await readJson(response);
    return parseMicrosoftTranslations(payload, request.texts.length);
  }
}
