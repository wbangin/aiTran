import type { CustomProviderConfig, PromptContext, TranslationScene } from './types';

export const MULTI_PARAGRAPH_SEPARATOR = '\n\n%%\n\n';

export const DEFAULT_SYSTEM_PROMPT = `You are a professional {{to}} native translator who translates text fluently into {{to}}.

## Translation rules
1. Output translated content only. Do not add explanations, labels, or introductory text.
2. Preserve the number of paragraphs and meaningful formatting of the source.
3. If the source contains HTML tags, keep the tags in suitable positions while preserving fluent text.
4. Keep code, placeholders, URLs, product names, and content that should not be translated unchanged.
5. If the input contains %% separators, return the same number of items separated by %% and do not add extra separators.{{title_prompt}}{{summary_prompt}}{{terms_prompt}}

## Output format
- Single item: return its translation directly.
- Multiple items: separate translations with a line containing only %%.

{{imt_style_guide}}`;

export const DEFAULT_SINGLE_PROMPT = `Translate to {{to}} (output translation only):

{{text}}`;

export const DEFAULT_SUBTITLE_PROMPT = `Translate the following subtitle to {{to}}. Preserve subtitle meaning and conversational tone. Output translation only:

{{text}}`;

export const DEFAULT_MULTI_PROMPT = `Translate every segment to {{to}}. Preserve order and return exactly the same number of segments, separated by a line containing only %%:

{{text}}`;

export const DEFAULT_PROMPT_CONFIG = {
  protocol: 'aitran-json' as const,
  model: '',
  temperature: 0,
  maxBatchSize: 4,
  batchMode: 'compatibility' as const,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  singlePrompt: DEFAULT_SINGLE_PROMPT,
  subtitlePrompt: DEFAULT_SUBTITLE_PROMPT,
  multiPrompt: DEFAULT_MULTI_PROMPT
};

const LANGUAGE_NAMES: Record<string, string> = {
  auto: 'the detected source language',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  ar: 'Arabic'
};

export function languagePromptName(language: string): string {
  return LANGUAGE_NAMES[language] ?? language;
}

export function normalizeCustomProviderConfig(provider: Partial<CustomProviderConfig>): CustomProviderConfig {
  return {
    id: provider.id ?? '',
    name: provider.name ?? '',
    url: provider.url ?? '',
    apiKey: provider.apiKey ?? '',
    enabled: provider.enabled ?? true,
    protocol: provider.protocol ?? DEFAULT_PROMPT_CONFIG.protocol,
    model: provider.model ?? DEFAULT_PROMPT_CONFIG.model,
    temperature: Number.isFinite(Number(provider.temperature)) ? Number(provider.temperature) : DEFAULT_PROMPT_CONFIG.temperature,
    maxBatchSize: Math.min(20, Math.max(1, Number(provider.maxBatchSize) || DEFAULT_PROMPT_CONFIG.maxBatchSize)),
    batchMode: provider.batchMode ?? DEFAULT_PROMPT_CONFIG.batchMode,
    systemPrompt: provider.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    singlePrompt: provider.singlePrompt || DEFAULT_SINGLE_PROMPT,
    subtitlePrompt: provider.subtitlePrompt || DEFAULT_SUBTITLE_PROMPT,
    multiPrompt: provider.multiPrompt || DEFAULT_MULTI_PROMPT
  };
}

function contextVariables(context?: PromptContext): Record<string, string> {
  const title = context?.title?.trim() ?? '';
  const summary = context?.summary?.trim() ?? '';
  const terms = context?.terms?.trim() ?? '';
  return {
    title: title,
    summary,
    terms,
    title_prompt: title ? `\n\n## Context\nDocument title: “${title}”` : '',
    summary_prompt: summary ? `\n\nDocument summary: ${summary}` : '',
    terms_prompt: terms ? `\n\nRequired terminology:\n${terms}` : '',
    imt_style_guide: context?.styleGuide?.trim() ?? '',
    imt_title: title,
    imt_theme: summary,
    imt_terms: terms
  };
}

export function renderPromptTemplate(
  template: string,
  values: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
    scene: TranslationScene;
    context?: PromptContext;
  }
): string {
  const variables: Record<string, string> = {
    text: values.text,
    from: languagePromptName(values.sourceLanguage),
    to: languagePromptName(values.targetLanguage),
    source_language: languagePromptName(values.sourceLanguage),
    target_language: languagePromptName(values.targetLanguage),
    scene: values.scene,
    ...contextVariables(values.context)
  };
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key]! : match
  ).trim();
}

export function promptForScene(provider: CustomProviderConfig, scene: TranslationScene, itemCount: number): string {
  if (scene === 'subtitle') return provider.subtitlePrompt;
  return itemCount > 1 ? provider.multiPrompt : provider.singlePrompt;
}
