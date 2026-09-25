import { describe, expect, it } from 'vitest';
import { aggregatePageStatuses, EMPTY_PAGE_STATUS, isPageStatus, normalizePageStatus, pageActionForStatus } from '../src/core/page-status';

describe('page status aggregation', () => {
  it('treats translations in any iframe as a translated page', () => {
    expect(aggregatePageStatuses([
      { translated: false, translating: false, translatedBlocks: 0, totalBlocks: 0 },
      { translated: true, translating: false, translatedBlocks: 7, totalBlocks: 7 }
    ])).toEqual({
      translated: true,
      translating: false,
      translatedBlocks: 7,
      totalBlocks: 7
    });
  });

  it('combines progress and preserves the first frame error', () => {
    expect(aggregatePageStatuses([
      { translated: true, translating: false, translatedBlocks: 3, totalBlocks: 3 },
      { translated: false, translating: true, translatedBlocks: 1, totalBlocks: 5, error: 'frame failed' }
    ])).toEqual({
      translated: true,
      translating: true,
      translatedBlocks: 4,
      totalBlocks: 8,
      error: 'frame failed'
    });
  });

  it('returns an empty status when no content frame has reported', () => {
    expect(aggregatePageStatuses([])).toEqual(EMPTY_PAGE_STATUS);
  });

  it('retries failed pages, including pages with partial translations', () => {
    expect(pageActionForStatus({ ...EMPTY_PAGE_STATUS, error: 'failed' })).toBe('translate');
    expect(pageActionForStatus({ ...EMPTY_PAGE_STATUS, translated: true, translatedBlocks: 1, error: 'failed' })).toBe('translate');
    expect(pageActionForStatus({ ...EMPTY_PAGE_STATUS, translated: true, translatedBlocks: 1 })).toBe('restore');
    expect(pageActionForStatus({ ...EMPTY_PAGE_STATUS, translating: true, error: 'failed' })).toBe('blocked');
  });

  it('falls back safely when a stale popup receives a null response', () => {
    expect(isPageStatus(null)).toBe(false);
    expect(normalizePageStatus(null)).toEqual(EMPTY_PAGE_STATUS);
  });

  it('normalizes valid numeric progress without trusting malformed fields', () => {
    expect(normalizePageStatus({
      translated: true,
      translating: false,
      translatedBlocks: 2.9,
      totalBlocks: -4,
      error: 123
    })).toEqual({
      translated: true,
      translating: false,
      translatedBlocks: 2,
      totalBlocks: 0
    });
  });
});
