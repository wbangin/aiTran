import type { Settings } from './types';

export const SETTINGS_KEY = 'aitran.settings.v1';
export const CACHE_DB_NAME = 'aitran-cache';
export const CACHE_STORE_NAME = 'translations';
export const CACHE_DB_VERSION = 1;
export const MAX_CACHE_ENTRIES = 5000;

export const DEFAULT_SETTINGS: Settings = {
  providerId: 'microsoft',
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  displayMode: 'bilingual',
  autoTranslate: false,
  autoFallback: true,
  selectionTranslation: true,
  hoverTranslation: false,
  inputTranslation: true,
  floatingBall: true,
  floatingBallTransparency: 40,
  customProviders: []
};

export function normalizeFloatingBallTransparency(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(80, Math.max(0, Math.round(value)))
    : DEFAULT_SETTINGS.floatingBallTransparency;
}

export const LANGUAGES = [
  ['auto', '自动检测'],
  ['zh-CN', '简体中文'],
  ['zh-TW', '繁體中文'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['pt', 'Português'],
  ['it', 'Italiano'],
  ['ru', 'Русский'],
  ['ar', 'العربية']
] as const;
