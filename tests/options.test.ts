// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { RuntimeMessage } from '../src/shared/types';

const queryTabs = vi.hoisted(() => vi.fn(async (): Promise<Array<{ id: number }>> => []));
vi.mock('wxt/browser', () => ({ browser: {
  runtime: { id: 'a'.repeat(32), sendMessage: vi.fn(), getPlatformInfo: vi.fn(async () => ({ os: 'mac' })) },
  commands: { getAll: vi.fn(async () => []) }, tabs: { query: queryTabs, sendMessage: vi.fn() }
} }));
const sendMessage = vi.mocked(browser.runtime.sendMessage);
const html = readFileSync(resolve('entrypoints/options/index.html'), 'utf8');
const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();
afterEach(() => vi.unstubAllGlobals());

beforeEach(async () => {
  vi.resetModules();
  // happy-dom does not implement the browser's Option constructor.
  vi.stubGlobal('Option', function Option(text: string, value: string) {
    const option = document.createElement('option'); option.text = text; option.value = value; return option;
  });
  sendMessage.mockReset();
  sendMessage.mockImplementation(async (raw: unknown) => {
    const message = raw as RuntimeMessage;
    if (message.type === 'GET_SETTINGS') return structuredClone(DEFAULT_SETTINGS);
    if (message.type === 'SAVE_SETTINGS') return message.settings;
    return {};
  });
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)![1]!.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  HTMLElement.prototype.scrollIntoView = vi.fn();
  await import('../entrypoints/options/main');
  await vi.waitFor(() => {
    const error = document.querySelector('#message.error')?.textContent;
    if (error) throw new Error(error);
    expect(document.querySelectorAll('#default-provider option')).toHaveLength(2);
  });
});

describe('custom API setup UI', () => {
  it('blocks remote HTTP on both test and save before sending any credentials', async () => {
    click('#add-provider');
    document.querySelector<HTMLInputElement>('[data-field="name"]')!.value = 'Private service';
    document.querySelector<HTMLInputElement>('[data-field="url"]')!.value = 'http://example.com/api';
    click('[data-action="test"]');
    await vi.waitFor(() => expect(document.querySelector('[data-field="testResult"]')!.textContent).toContain('必须使用 HTTPS'));
    click('#save');
    await vi.waitFor(() => expect(document.querySelector('#message')!.textContent).toContain('必须使用 HTTPS'));
    expect(sendMessage.mock.calls.some(([raw]) => ['TEST_CUSTOM_PROVIDER', 'SAVE_SETTINGS'].includes((raw as unknown as RuntimeMessage).type))).toBe(false);
  });
  it('previews transparency immediately without saving or mounting page controls', () => {
    const preview = document.querySelector<HTMLElement>('#floating-ball-preview')!;
    const ball = preview.shadowRoot!.querySelector<HTMLElement>('.ball')!;
    const slider = document.querySelector<HTMLInputElement>('#floating-ball-transparency')!;
    expect(ball.textContent).toBe('AiT');
    expect(ball.style.getPropertyValue('--ball-alpha')).toBe('0.6');
    for (const value of [0, 80, 50]) {
      slider.value = String(value);
      slider.dispatchEvent(new Event('input'));
      expect(Number(ball.style.getPropertyValue('--ball-alpha'))).toBeCloseTo(1 - value / 100);
      expect(preview.getAttribute('aria-label')).toContain(`${value}%`);
    }
    expect(document.querySelector('#aitran-floating-toolbar')).toBeNull();
    expect(preview.shadowRoot!.querySelector('button')).toBeNull();
    expect(sendMessage.mock.calls.some(([raw]) => (raw as unknown as RuntimeMessage).type === 'SAVE_SETTINGS')).toBe(false);
  });

  it('displays, saves and broadcasts floating-ball transparency, retaining it when disabled', async () => {
    const slider = document.querySelector<HTMLInputElement>('#floating-ball-transparency')!;
    expect(slider.value).toBe('40');
    slider.value = '65';
    slider.dispatchEvent(new Event('input'));
    expect(document.querySelector('output')?.textContent).toBe('65%');
    const toggle = document.querySelector<HTMLInputElement>('#floating-ball')!;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(slider.disabled).toBe(true);
    expect(document.querySelector('#floating-ball-preview-caption')?.textContent).toContain('已关闭');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(slider.disabled).toBe(false);
    queryTabs.mockResolvedValueOnce([{ id: 23 }]);
    vi.mocked(browser.tabs.sendMessage).mockResolvedValueOnce(undefined);
    click('#save');
    await vi.waitFor(() => expect(document.querySelector('#message')?.textContent).toContain('设置已保存'));
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'SAVE_SETTINGS', settings: expect.objectContaining({ floatingBallTransparency: 65 }) }));
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(23, { type: 'REFRESH_SETTINGS' });
  });

  it('exposes only custom API protocols and no local helper controls', () => {
    click('#add-provider');
    expect([...document.querySelectorAll<HTMLSelectElement>('[data-field="protocol"] option')].map((option) => option.value)).toEqual(['aitran-json', 'openai-compatible']);
    expect(document.querySelector('#add-codex')).toBeNull();
    expect(document.querySelector('[data-section="native-help"]')).toBeNull();
  });
  it('completes the URL on protocol selection and blur without duplicating the suffix', () => {
    click('#add-provider');
    const protocol = document.querySelector<HTMLSelectElement>('[data-field="protocol"]')!;
    const url = document.querySelector<HTMLInputElement>('[data-field="url"]')!;
    url.value = 'https://ark.cn-beijing.volces.com/api/coding/v3';
    protocol.value = 'openai-compatible';
    protocol.dispatchEvent(new Event('change'));
    expect(url.value).toBe('https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions');
    expect(document.querySelector<HTMLElement>('[data-section="openai-url-help"]')!.hidden).toBe(false);
    url.value = 'https://example.com/v1/?api-version=test';
    url.dispatchEvent(new Event('blur'));
    url.dispatchEvent(new Event('blur'));
    expect(url.value).toBe('https://example.com/v1/chat/completions?api-version=test');
    protocol.value = 'aitran-json';
    protocol.dispatchEvent(new Event('change'));
    url.value = 'https://example.com/translate';
    url.dispatchEvent(new Event('blur'));
    expect(url.value).toBe('https://example.com/translate');
    expect(document.querySelector<HTMLElement>('[data-section="openai-url-help"]')!.hidden).toBe(true);
  });

  it('completes the URL before testing and saving even without a blur event', async () => {
    click('#add-provider');
    const protocol = document.querySelector<HTMLSelectElement>('[data-field="protocol"]')!;
    const url = document.querySelector<HTMLInputElement>('[data-field="url"]')!;
    protocol.value = 'openai-compatible';
    protocol.dispatchEvent(new Event('change'));
    document.querySelector<HTMLInputElement>('[data-field="name"]')!.value = 'Test AI';
    document.querySelector<HTMLInputElement>('[data-field="model"]')!.value = 'test-model';
    url.value = 'https://example.com/api/v3/';
    click('[data-action="test"]');
    const tested = sendMessage.mock.calls.map(([raw]) => raw as unknown as RuntimeMessage).find((message) => message.type === 'TEST_CUSTOM_PROVIDER');
    expect(tested?.type).toBe('TEST_CUSTOM_PROVIDER');
    if (tested?.type !== 'TEST_CUSTOM_PROVIDER') throw new Error('Connection not tested');
    expect(tested.provider.url).toBe('https://example.com/api/v3/chat/completions');
    url.value = 'https://example.com/v1/?version=1';
    click('#save');
    await vi.waitFor(() => expect(document.querySelector('#message')?.textContent).toContain('设置已保存'));
    const saved = sendMessage.mock.calls.map(([raw]) => raw as unknown as RuntimeMessage).find((message) => message.type === 'SAVE_SETTINGS');
    if (saved?.type !== 'SAVE_SETTINGS') throw new Error('Settings not saved');
    expect(saved.settings.customProviders[0]?.url).toBe('https://example.com/v1/chat/completions?version=1');
  });
});
