export type BuiltinProviderId = 'google' | 'microsoft';
export type ProviderId = BuiltinProviderId | `custom:${string}`;
export type DisplayMode = 'bilingual' | 'translation-only';
export type CustomProviderProtocol = 'aitran-json' | 'openai-compatible';
export type CustomBatchMode = 'compatibility' | 'independent';
export type TranslationScene = 'page' | 'text' | 'document' | 'subtitle' | 'selection' | 'hover' | 'input' | 'test';

export interface PromptContext {
  title?: string;
  summary?: string;
  terms?: string;
  styleGuide?: string;
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  protocol: CustomProviderProtocol;
  model: string;
  temperature: number;
  maxBatchSize: number;
  batchMode: CustomBatchMode;
  systemPrompt: string;
  singlePrompt: string;
  subtitlePrompt: string;
  multiPrompt: string;
}

export interface Settings {
  providerId: ProviderId;
  sourceLanguage: string;
  targetLanguage: string;
  displayMode: DisplayMode;
  autoTranslate: boolean;
  autoFallback: boolean;
  selectionTranslation: boolean;
  hoverTranslation: boolean;
  inputTranslation: boolean;
  floatingBall: boolean;
  floatingBallTransparency: number;
  customProviders: CustomProviderConfig[];
}

export interface TranslateRequest {
  texts: string[];
  sourceLanguage: string;
  targetLanguage: string;
  providerId: ProviderId;
  scene?: TranslationScene;
  context?: PromptContext;
}

export interface TranslateResult {
  translations: string[];
  detectedLanguage?: string;
  providerId: ProviderId;
  cachedCount: number;
}

export interface PageSummaryRequest {
  title: string;
  text: string;
  targetLanguage: string;
  providerId: ProviderId;
}

export type PageSummaryResponse =
  | { ok: true; summary: string; providerName: string }
  | { ok: false; error: string };

export interface ProviderTranslateRequest {
  texts: string[];
  sourceLanguage: string;
  targetLanguage: string;
  scene: TranslationScene;
  context?: PromptContext;
  signal?: AbortSignal;
}

export interface ProviderTranslateResult {
  translations: string[];
  detectedLanguage?: string;
}

export interface TranslationProvider {
  id: ProviderId;
  name: string;
  translate(request: ProviderTranslateRequest): Promise<ProviderTranslateResult>;
}

export type RuntimeMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Settings }
  | { type: 'TRANSLATE_BATCH'; request: TranslateRequest }
  | { type: 'TEST_CUSTOM_PROVIDER'; provider: CustomProviderConfig }
  | { type: 'OPEN_ACTIVE_PAGE_SUMMARY' }
  | { type: 'OPEN_PAGE_SUMMARY' }
  | { type: 'SUMMARIZE_PAGE'; request: PageSummaryRequest }
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'GET_PAGE_STATUS' }
  | { type: 'GET_ACTIVE_PAGE_STATUS' }
  | { type: 'REQUEST_PAGE_STATUS_REPORT' }
  | { type: 'REPORT_PAGE_STATUS'; status: PageStatus }
  | { type: 'PAGE_STATUS_CHANGED'; tabId: number; status: PageStatus }
  | { type: 'SYNC_PAGE_STATUS'; status: PageStatus }
  | { type: 'TOGGLE_ACTIVE_PAGE' }
  | { type: 'TRANSLATE_PAGE' }
  | { type: 'RESTORE_PAGE' }
  | { type: 'TOGGLE_PAGE' }
  | { type: 'REFRESH_SETTINGS' }
  | { type: 'SET_DISPLAY_MODE'; displayMode: DisplayMode }
  | { type: 'TRANSLATE_INPUT' }
  | { type: 'TRANSLATE_CONTEXT_SELECTION'; text: string };

export interface PageStatus {
  translated: boolean;
  translating: boolean;
  translatedBlocks: number;
  totalBlocks: number;
  error?: string;
}

export interface PlainTextProgress {
  completed: number;
  total: number;
}
