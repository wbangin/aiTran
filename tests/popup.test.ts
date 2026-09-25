// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { EMPTY_PAGE_STATUS } from '../src/core/page-status';
import type { RuntimeMessage } from '../src/shared/types';

const mock = vi.hoisted(() => ({ sendMessage: vi.fn(), listener: vi.fn(), getAll: vi.fn(), tabMessage: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: {
  runtime: { sendMessage: mock.sendMessage, onMessage: { addListener: mock.listener }, getPlatformInfo: async () => ({ os: 'mac' }), getURL: (path: string) => path, openOptionsPage: vi.fn() },
  commands: { getAll: mock.getAll },
  tabs: { query: async () => [{ id: 7 }], sendMessage: mock.tabMessage, create: vi.fn() }
} }));
const html = readFileSync(resolve('entrypoints/popup/index.html'), 'utf8');
const button = (id: string) => document.querySelector<HTMLButtonElement>(`#${id}`)!;
async function mount() {
  await import('../entrypoints/popup/main');
  await vi.waitFor(() => expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'GET_ACTIVE_PAGE_STATUS' }));
  await vi.waitFor(() => expect(button('summarize-page').disabled).toBe(false));
}
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubGlobal('Option', function Option(text: string, value: string) {
    const option = document.createElement('option'); option.text = text; option.value = value; return option;
  });
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)![1]!.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  mock.getAll.mockResolvedValue([{ name: 'toggleTranslation', shortcut: '' }, { name: 'translateInput', shortcut: '' }]);
  mock.tabMessage.mockResolvedValue({ ok: true });
  mock.sendMessage.mockImplementation(async (message: RuntimeMessage) => {
    if (message.type === 'GET_SETTINGS') return structuredClone(DEFAULT_SETTINGS);
    if (message.type === 'SAVE_SETTINGS') return message.settings;
    if (message.type === 'GET_ACTIVE_PAGE_STATUS') return { ...EMPTY_PAGE_STATUS };
    if (message.type === 'TOGGLE_ACTIVE_PAGE') return { ...EMPTY_PAGE_STATUS, translated: true, translatedBlocks: 3, totalBlocks: 3 };
    if (message.type === 'OPEN_ACTIVE_PAGE_SUMMARY') return { ok: true };
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('compact popup', () => {
  it('groups translation with mode and settings, followed by summary and page features', async () => {
    await mount();
    expect(button('translate').closest('.topbar')).not.toBeNull();
    expect(document.querySelector('#display-mode')!.closest('.topbar')).not.toBeNull();
    expect(document.querySelector('.translation-group')!.nextElementSibling).toBe(button('summarize-page'));
    expect(document.querySelector('.translation-group #provider')).not.toBeNull();
    expect(button('summarize-page').nextElementSibling!.textContent).toContain('页面功能');
    expect(document.querySelector('#status')!.textContent).toBe('');
    expect(button('selection-translate').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.edition-badge,#page-shortcut')).toBeNull();
    expect(document.body.textContent).not.toContain('免费版');
    expect(button('translate').textContent).toBe('翻译网页');
    expect(button('translate').title).not.toContain('未设置');
    expect(document.querySelector<HTMLElement>('#input-shortcut')!.hidden).toBe(true);
  });

  it('keeps assigned page shortcuts in the tooltip and translation/restore/progress behavior', async () => {
    mock.getAll.mockResolvedValue([{ name: 'toggleTranslation', shortcut: 'Command+Shift+L' }]);
    await mount();
    expect(button('translate').title).toContain('⌘⇧L');
    expect(button('translate').textContent).toBe('翻译网页');
    button('translate').click();
    await vi.waitFor(() => expect(button('translate').textContent).toBe('显示原文'));
    expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'TOGGLE_ACTIVE_PAGE' });
    expect(button('translate').classList.contains('restore')).toBe(true);
    mock.listener.mock.calls[0]![0]({ type: 'PAGE_STATUS_CHANGED', tabId: 7, status: { ...EMPTY_PAGE_STATUS, translating: true, translatedBlocks: 1, totalBlocks: 5 } });
    expect(button('translate').disabled).toBe(true);
    expect(button('translate').textContent).toBe('翻译中…');
    expect(document.querySelector('#status')!.textContent).toContain('1/5');
  });

  it('opens summary from the promoted entry and retains the display-mode toggle', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    await mount();
    const mode = document.querySelector<HTMLSelectElement>('#display-mode')!;
    mode.value = 'translation-only';
    mode.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(mock.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'SAVE_SETTINGS', settings: expect.objectContaining({ displayMode: 'translation-only' }) })));
    button('summarize-page').click();
    await vi.waitFor(() => expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'OPEN_ACTIVE_PAGE_SUMMARY' }));
    expect(close).toHaveBeenCalledOnce();
  });
});
