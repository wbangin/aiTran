import type { PageStatus } from '../shared/types';

export const EMPTY_PAGE_STATUS: PageStatus = {
  translated: false,
  translating: false,
  translatedBlocks: 0,
  totalBlocks: 0
};

export function pageActionForStatus(status: PageStatus): 'blocked' | 'restore' | 'translate' {
  if (status.translating) return 'blocked';
  return status.translated && !status.error ? 'restore' : 'translate';
}

export function aggregatePageStatuses(statuses: Iterable<PageStatus>): PageStatus {
  const aggregate: PageStatus = { ...EMPTY_PAGE_STATUS };

  for (const status of statuses) {
    aggregate.translated ||= status.translated;
    aggregate.translating ||= status.translating;
    aggregate.translatedBlocks += status.translatedBlocks;
    aggregate.totalBlocks += status.totalBlocks;
    if (!aggregate.error && status.error) aggregate.error = status.error;
  }

  return aggregate;
}


export function isPageStatus(value: unknown): value is PageStatus {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<PageStatus>;
  return typeof status.translated === 'boolean'
    && typeof status.translating === 'boolean'
    && typeof status.translatedBlocks === 'number'
    && Number.isFinite(status.translatedBlocks)
    && typeof status.totalBlocks === 'number'
    && Number.isFinite(status.totalBlocks);
}

export function normalizePageStatus(value: unknown, fallback: PageStatus = EMPTY_PAGE_STATUS): PageStatus {
  if (!isPageStatus(value)) return { ...fallback };
  return {
    translated: value.translated,
    translating: value.translating,
    translatedBlocks: Math.max(0, Math.floor(value.translatedBlocks)),
    totalBlocks: Math.max(0, Math.floor(value.totalBlocks)),
    ...(typeof value.error === 'string' && value.error ? { error: value.error } : {})
  };
}
