const MICROSOFT_LANGUAGE_MAP: Record<string, string> = {
  auto: '',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  pt: 'pt-PT',
  it: 'it',
  ru: 'ru',
  ar: 'ar'
};

const GOOGLE_LANGUAGE_MAP: Record<string, string> = {
  auto: 'auto',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  pt: 'pt-PT',
  it: 'it',
  ru: 'ru',
  ar: 'ar'
};

export function toMicrosoftLanguage(language: string): string {
  return MICROSOFT_LANGUAGE_MAP[language] ?? language;
}

export function toGoogleLanguage(language: string): string {
  return GOOGLE_LANGUAGE_MAP[language] ?? language;
}
