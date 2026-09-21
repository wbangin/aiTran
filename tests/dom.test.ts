import { describe, expect, it } from 'vitest';
import { createBatches, hasTranslatableText, isMeaningfulBlockText, normalizeText, restoreProtectedText, type TranslationBlock } from '../src/core/dom';

describe('DOM translation helpers', () => {
  it('normalizes whitespace', () => {
    expect(normalizeText('  hello\n  world  ')).toBe('hello world');
  });

  it('filters punctuation and accepts natural language', () => {
    expect(hasTranslatableText('123 -- !!!')).toBe(false);
    expect(hasTranslatableText('Hello world')).toBe(true);
    expect(hasTranslatableText('你好，世界')).toBe(true);
  });

  it('filters short UI labels, paths, and filenames from page blocks', () => {
    expect(isMeaningfulBlockText('Code', 'heading')).toBe(false);
    expect(isMeaningfulBlockText('page-assist', 'heading')).toBe(false);
    expect(isMeaningfulBlockText('extensions/page-action', 'generic')).toBe(false);
    expect(isMeaningfulBlockText('wxt.config.ts', 'generic')).toBe(false);
    expect(isMeaningfulBlockText('Use your local AI models in the browser', 'heading')).toBe(true);
  });

  it('restores protected inline-code placeholders without translating the code', () => {
    expect(restoreProtectedText(
      '运行 __AITRAN_CODE_0__ 后启动工作流。',
      [{ token: '__AITRAN_CODE_0__', text: 'uv add "pydantic-ai[temporal]"' }]
    )).toBe('运行 uv add "pydantic-ai[temporal]" 后启动工作流。');
  });

  it('creates batches by count and character budget', () => {
    const blocks = ['aaaa', 'bbbb', 'cccc'].map((text) => ({ text, element: {} as HTMLElement }));
    const batches = createBatches(blocks as TranslationBlock[], 2, 8);
    expect(batches.map((batch) => batch.map((entry) => entry.text))).toEqual([
      ['aaaa', 'bbbb'],
      ['cccc']
    ]);
  });
});
