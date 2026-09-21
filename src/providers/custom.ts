import { AiTranError } from '../shared/errors';
import {
  MULTI_PARAGRAPH_SEPARATOR,
  normalizeCustomProviderConfig,
  promptForScene,
  renderPromptTemplate
} from '../shared/prompts';
import type {
  CustomProviderConfig,
  ProviderTranslateRequest,
  ProviderTranslateResult,
  TranslationProvider
} from '../shared/types';
import { fetchWithRetry, readJson } from './http';

interface CustomProviderResponse {
  translations?: Array<string | { text?: string }>;
  detectedLanguage?: string;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  output_text?: string;
  error?: { message?: string };
}

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
  return parsed;
}

export function parseCustomTranslations(payload: unknown, expectedCount: number): ProviderTranslateResult {
  if (!payload || typeof payload !== 'object') {
    throw new AiTranError('自定义服务返回格式无效', 'INVALID_RESPONSE');
  }
  const response = payload as CustomProviderResponse;
  if (!Array.isArray(response.translations) || response.translations.length !== expectedCount) {
    throw new AiTranError(`自定义服务应返回 ${expectedCount} 条翻译结果`, 'INVALID_RESPONSE');
  }
  const translations = response.translations.map((entry) => typeof entry === 'string' ? entry : entry?.text);
  if (!translations.every((text): text is string => typeof text === 'string')) {
    throw new AiTranError('自定义服务 translations 必须是字符串数组', 'INVALID_RESPONSE');
  }
  return { translations, detectedLanguage: response.detectedLanguage };
}

export function parseOpenAIContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new AiTranError('AI 服务返回格式无效', 'INVALID_RESPONSE');
  const response = payload as OpenAIChatResponse;
  if (response.error?.message) throw new AiTranError(response.error.message, 'AI_API_ERROR');
  if (typeof response.output_text === 'string') return response.output_text.trim();
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => part.text ?? '').join('').trim();
    if (text) return text;
  }
  throw new AiTranError('AI 服务未返回 choices[0].message.content', 'INVALID_RESPONSE');
}

export function splitMultiTranslation(content: string, expectedCount: number): string[] {
  if (expectedCount === 1) return [content.trim()];
  const parts = content.split(/\n\s*%%\s*\n/g).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== expectedCount) {
    throw new AiTranError(`AI 服务返回了 ${parts.length} 段，预期 ${expectedCount} 段`, 'AI_PARAGRAPH_MISMATCH');
  }
  return parts;
}

export class CustomProvider implements TranslationProvider {
  readonly id: `custom:${string}`;
  readonly name: string;
  private readonly config: CustomProviderConfig;

  constructor(config: CustomProviderConfig) {
    this.config = normalizeCustomProviderConfig(config);
    this.id = `custom:${this.config.id}`;
    this.name = this.config.name;
  }

  async translate(request: ProviderTranslateRequest): Promise<ProviderTranslateResult> {
    return this.config.protocol === 'openai-compatible'
      ? await this.translateOpenAI(request)
      : await this.translateAiTranJson(request);
  }

  private async translateAiTranJson(request: ProviderTranslateRequest): Promise<ProviderTranslateResult> {
    const url = validateCustomProviderUrl(this.config.url);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.config.apiKey.trim()) headers.authorization = `Bearer ${this.config.apiKey.trim()}`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        texts: request.texts,
        scene: request.scene,
        context: request.context
      })
    }, { signal: request.signal });
    return parseCustomTranslations(await readJson(response), request.texts.length);
  }

  private async translateOpenAI(request: ProviderTranslateRequest): Promise<ProviderTranslateResult> {
    if (!this.config.model.trim()) throw new AiTranError('OpenAI 兼容服务需要填写模型名称', 'MODEL_REQUIRED');
    const translations: string[] = [];
    if (this.config.batchMode === 'independent') {
      for (const text of request.texts) translations.push(...await this.translateOpenAIBatch(request, [text]));
      return { translations };
    }
    const batchSize = Math.max(1, this.config.maxBatchSize);
    for (let offset = 0; offset < request.texts.length; offset += batchSize) {
      const texts = request.texts.slice(offset, offset + batchSize);
      try {
        translations.push(...await this.translateOpenAIBatch(request, texts));
      } catch (error) {
        if (texts.length === 1) throw error;
        // If a model fails to preserve separators, recover each item independently.
        for (const text of texts) translations.push(...await this.translateOpenAIBatch(request, [text]));
      }
    }
    return { translations };
  }

  private async translateOpenAIBatch(request: ProviderTranslateRequest, texts: string[]): Promise<string[]> {
    const url = validateCustomProviderUrl(this.config.url);
    const joinedText = texts.join(MULTI_PARAGRAPH_SEPARATOR);
    const values = {
      text: joinedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      scene: request.scene,
      context: request.context
    };
    const systemPrompt = renderPromptTemplate(this.config.systemPrompt, values);
    const userPrompt = renderPromptTemplate(promptForScene(this.config, request.scene, texts.length), values);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.config.apiKey.trim()) headers.authorization = `Bearer ${this.config.apiKey.trim()}`;

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model.trim(),
        temperature: this.config.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    }, { signal: request.signal, timeoutMs: 45_000 });
    return splitMultiTranslation(parseOpenAIContent(await readJson(response)), texts.length);
  }
}
