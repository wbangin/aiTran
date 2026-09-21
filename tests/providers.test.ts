import { describe, expect, it } from 'vitest';
import { parseGoogleTranslations } from '../src/providers/google';
import { parseMicrosoftTranslations } from '../src/providers/microsoft';
import { parseCustomTranslations, validateCustomProviderUrl } from '../src/providers/custom';

 describe('provider response parsing', () => {
  it('parses Google batch responses', () => {
    expect(parseGoogleTranslations([['你好', 'Hello'], ['世界', 'World']], 2)).toEqual(['你好', '世界']);
  });

  it('parses Google nested single responses', () => {
    expect(parseGoogleTranslations([[['你', 'You'], ['好', 'good']]], 1)).toEqual(['你好']);
  });

  it('decodes Google HTML entities', () => {
    expect(parseGoogleTranslations([['A &amp; B']], 1)).toEqual(['A & B']);
  });

  it('parses Microsoft responses', () => {
    expect(parseMicrosoftTranslations([
      { detectedLanguage: { language: 'en' }, translations: [{ text: '你好', to: 'zh-Hans' }] },
      { translations: [{ text: '世界', to: 'zh-Hans' }] }
    ], 2)).toEqual({ translations: ['你好', '世界'], detectedLanguage: 'en' });
  });

  it('parses custom string and object translations', () => {
    expect(parseCustomTranslations({
      translations: ['你好', { text: '世界' }],
      detectedLanguage: 'en'
    }, 2)).toEqual({ translations: ['你好', '世界'], detectedLanguage: 'en' });
  });

  it('rejects unsupported custom URL protocols', () => {
    expect(() => validateCustomProviderUrl('file:///tmp/translate')).toThrow(/HTTP/);
  });
});

import { afterEach, vi } from 'vitest';
import { CustomProvider } from '../src/providers/custom';
import { normalizeCustomProviderConfig } from '../src/shared/prompts';

afterEach(() => vi.unstubAllGlobals());

describe('OpenAI-compatible custom provider', () => {
  it('sends rendered system and multi-segment prompts', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model: string; messages: Array<{ role: string; content: string }> };
      expect(body.model).toBe('gpt-test');
      expect(body.messages[0]?.content).toContain('Simplified Chinese');
      expect(body.messages[1]?.content).toContain('Hello\n\n%%\n\nWorld');
      return new Response(JSON.stringify({ choices: [{ message: { content: '你好\n\n%%\n\n世界' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new CustomProvider(normalizeCustomProviderConfig({
      id: 'openai', name: 'OpenAI', url: 'https://example.com/v1/chat/completions', apiKey: 'secret', enabled: true,
      protocol: 'openai-compatible', model: 'gpt-test', batchMode: 'compatibility'
    }));
    const result = await provider.translate({
      texts: ['Hello', 'World'], sourceLanguage: 'en', targetLanguage: 'zh-CN', scene: 'page', context: { title: 'Test page' }
    });
    expect(result.translations).toEqual(['你好', '世界']);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
