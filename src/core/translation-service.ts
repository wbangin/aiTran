import { errorMessage } from '../shared/errors';
import type { ProviderId, Settings, TranslateRequest, TranslateResult } from '../shared/types';
import { TranslationCache } from '../storage/cache';
import { createProvider, fallbackProviderId } from '../providers';

const cache = new TranslationCache();

function stringHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cacheNamespace(request: TranslateRequest, settings: Settings): string {
  const scene = request.scene ?? 'page';
  if (!request.providerId.startsWith('custom:')) return `${request.providerId}:${scene}`;
  const id = request.providerId.slice('custom:'.length);
  const provider = settings.customProviders.find((item) => item.id === id);
  if (!provider) return `${request.providerId}:${scene}`;
  const promptRevision = stringHash(JSON.stringify({
    url: provider.url, protocol: provider.protocol, model: provider.model, temperature: provider.temperature, batchMode: provider.batchMode,
    systemPrompt: provider.systemPrompt, singlePrompt: provider.singlePrompt,
    subtitlePrompt: provider.subtitlePrompt, multiPrompt: provider.multiPrompt,
    context: request.context
  }));
  return `${request.providerId}:${scene}:${promptRevision}`;
}

async function translateUncached(
  providerId: ProviderId,
  settings: Settings,
  request: TranslateRequest,
  texts: string[]
): Promise<{ translations: string[]; detectedLanguage?: string; providerId: ProviderId }> {
  const provider = createProvider(providerId, settings);
  const result = await provider.translate({
    texts,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    scene: request.scene ?? 'page',
    context: request.context
  });
  if (result.translations.length !== texts.length) {
    throw new Error(`${provider.name} returned an invalid number of translations`);
  }
  return { ...result, providerId };
}

export async function translateBatch(request: TranslateRequest, settings: Settings): Promise<TranslateResult> {
  const translations = new Array<string>(request.texts.length);
  const namespace = cacheNamespace(request, settings);
  const missingIndices: number[] = [];

  await Promise.all(
    request.texts.map(async (text, index) => {
      const cached = await cache.get(namespace, request.sourceLanguage, request.targetLanguage, text);
      if (cached === undefined) missingIndices.push(index);
      else translations[index] = cached;
    })
  );

  let usedProviderId = request.providerId;
  let detectedLanguage: string | undefined;
  if (missingIndices.length) {
    const missingTexts = missingIndices.map((index) => request.texts[index] ?? '');
    try {
      const result = await translateUncached(request.providerId, settings, request, missingTexts);
      usedProviderId = result.providerId;
      detectedLanguage = result.detectedLanguage;
      result.translations.forEach((translation, position) => {
        const originalIndex = missingIndices[position];
        if (originalIndex !== undefined) translations[originalIndex] = translation;
      });
    } catch (primaryError) {
      const fallback = settings.autoFallback ? fallbackProviderId(request.providerId) : undefined;
      if (!fallback) throw primaryError;
      try {
        const result = await translateUncached(fallback, settings, request, missingTexts);
        usedProviderId = result.providerId;
        detectedLanguage = result.detectedLanguage;
        result.translations.forEach((translation, position) => {
          const originalIndex = missingIndices[position];
          if (originalIndex !== undefined) translations[originalIndex] = translation;
        });
      } catch (fallbackError) {
        throw new Error(
          `主服务失败：${errorMessage(primaryError)}；备用服务失败：${errorMessage(fallbackError)}`
        );
      }
    }

    await Promise.all(
      missingIndices.map((originalIndex) =>
        cache.set(
          namespace,
          request.sourceLanguage,
          request.targetLanguage,
          request.texts[originalIndex] ?? '',
          translations[originalIndex] ?? ''
        )
      )
    );
  }

  return {
    translations,
    detectedLanguage,
    providerId: usedProviderId,
    cachedCount: request.texts.length - missingIndices.length
  };
}
