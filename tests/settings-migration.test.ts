import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/shared/constants';
import { normalizeCustomProviderConfig } from '../src/shared/prompts';
import { normalizeSettings, getSettings, saveSettings } from '../src/storage/settings';
import { CustomProvider } from '../src/providers/custom';
import { summarizePageContent } from '../src/core/summary-service';
import { summaryProviders } from '../src/shared/summary';
import type { CustomProviderConfig, Settings } from '../src/shared/types';

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { storage: { local: storage } } }));
const api = normalizeCustomProviderConfig({ id: 'api', name: 'My API', url: 'https://example.com/v1', apiKey: 'keep-private', protocol: 'openai-compatible', model: 'my-model', systemPrompt: 'Keep my prompt' });
const retired = (protocol: string): CustomProviderConfig => ({ ...api, id: protocol, protocol, url: 'http://127.0.0.1:32145', apiKey: 'old-pairing-key' }) as CustomProviderConfig;
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('custom API-only settings migration', () => {
  it('defaults old floating-ball settings and clamps invalid transparency values', async () => {
    expect(normalizeSettings({}).floatingBallTransparency).toBe(40);
    for (const value of [undefined, NaN, Infinity, '70', null]) {
      expect(normalizeSettings({ floatingBallTransparency: value } as Partial<Settings>).floatingBallTransparency).toBe(40);
    }
    expect(normalizeSettings({ floatingBallTransparency: -10 }).floatingBallTransparency).toBe(0);
    expect(normalizeSettings({ floatingBallTransparency: 100 }).floatingBallTransparency).toBe(80);
    const saved = await saveSettings({ ...DEFAULT_SETTINGS, floatingBallTransparency: 65 });
    storage.get.mockResolvedValueOnce({ [SETTINGS_KEY]: saved });
    expect((await getSettings()).floatingBallTransparency).toBe(65);
  });

  it('removes both retired protocols, preserves API settings, and disables automatic sends when selection changes', () => {
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, providerId: 'custom:native-codex', autoTranslate: true, autoFallback: true,
      customProviders: [retired('native-codex'), retired('local-codex'), api] });
    expect(settings.customProviders).toEqual([api]);
    expect(settings.providerId).toBe('custom:api');
    expect(settings.autoTranslate).toBe(false);
    expect(settings.autoFallback).toBe(false);
  });

  it('keeps an existing API selection and user preferences unchanged', () => {
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, providerId: 'custom:api', autoTranslate: true, autoFallback: true,
      customProviders: [api, retired('local-codex')] });
    expect(settings).toMatchObject({ providerId: 'custom:api', autoTranslate: true, autoFallback: true, customProviders: [api] });
  });

  it('falls back to the default without auto-translating if no API is available and accepts old JSON defaults', () => {
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, providerId: 'custom:local-codex', autoTranslate: true,
      customProviders: [retired('local-codex'), { ...api, enabled: false }] });
    expect(settings.providerId).toBe(DEFAULT_SETTINGS.providerId);
    expect(settings.autoTranslate).toBe(false);
    expect(normalizeSettings({ customProviders: [{ ...api, protocol: undefined } as unknown as CustomProviderConfig] }).customProviders[0]?.protocol).toBe('aitran-json');
    expect(normalizeSettings({ customProviders: {} as Settings['customProviders'] }).customProviders).toEqual([]);
  });

  it('persists removal on load, is idempotent, and prevents reintroduction on save', async () => {
    storage.get.mockResolvedValueOnce({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, customProviders: [api, retired('local-codex')] } });
    const settings = await getSettings();
    expect(browser.storage.local.set).toHaveBeenCalledWith({ [SETTINGS_KEY]: settings });
    expect(settings.customProviders).toEqual([api]);
    vi.mocked(browser.storage.local.set).mockClear();
    storage.get.mockResolvedValueOnce({ [SETTINGS_KEY]: settings });
    expect(await getSettings()).toEqual(settings);
    expect(browser.storage.local.set).not.toHaveBeenCalled();
    expect((await saveSettings({ ...settings, customProviders: [api, retired('native-codex')] })).customProviders).toEqual([api]);
  });

  it('rejects retired/unknown protocols before they can be treated as HTTP JSON requests', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    for (const protocol of ['native-codex', 'local-codex', 'unknown']) {
      expect(() => new CustomProvider(retired(protocol))).toThrow('不再支持');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers only enabled OpenAI-compatible APIs with a model for summaries', async () => {
    const settings = { ...DEFAULT_SETTINGS, customProviders: [api, retired('native-codex'), retired('local-codex'),
      { ...api, id: 'json', protocol: 'aitran-json' as const }, { ...api, id: 'blank', model: '' }, { ...api, id: 'disabled', enabled: false }] };
    expect(summaryProviders(settings)).toEqual([api]);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(summarizePageContent({ title: 'Test', text: 'Source', targetLanguage: 'zh-CN', providerId: 'custom:local-codex' }, settings)).rejects.toThrow('自定义');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
