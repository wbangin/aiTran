import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../shared/constants';
import type { Settings } from '../shared/types';
import { normalizeCustomProviderConfig } from '../shared/prompts';

function normalizeSettings(value: Partial<Settings> | undefined): Settings {
  const customProviders = Array.isArray(value?.customProviders)
    ? value.customProviders
      .filter((provider) => provider && provider.id && provider.url)
      .map((provider) => normalizeCustomProviderConfig(provider))
    : [];

  return {
    ...DEFAULT_SETTINGS,
    ...value,
    customProviders
  } as Settings;
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const normalized = normalizeSettings(settings);
  await browser.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}
