import { describe, expect, it } from 'vitest';
import { toGoogleLanguage, toMicrosoftLanguage } from '../src/shared/language';

describe('language mappings', () => {
  it('maps Chinese variants for Microsoft', () => {
    expect(toMicrosoftLanguage('zh-CN')).toBe('zh-Hans');
    expect(toMicrosoftLanguage('zh-TW')).toBe('zh-Hant');
  });

  it('maps automatic source language', () => {
    expect(toMicrosoftLanguage('auto')).toBe('');
    expect(toGoogleLanguage('auto')).toBe('auto');
  });
});
