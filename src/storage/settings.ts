import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, SETTINGS_KEY, normalizeFloatingBallTransparency } from '../shared/constants';
import type { Settings } from '../shared/types';
import { normalizeCustomProviderConfig } from '../shared/prompts';

function supportedProtocol(provider: { protocol?: string }): boolean {
  return provider.protocol === undefined || provider.protocol === 'aitran-json' || provider.protocol === 'openai-compatible';
}

export function normalizeSettings(value: Partial<Settings> | undefined): Settings {
  const customProviders = Array.isArray(value?.customProviders)
    ? value.customProviders
      .filter((provider) => provider && provider.id && provider.url && supportedProtocol(provider))
      .map((provider) => normalizeCustomProviderConfig(provider))
    : [];

  const selectedWasRemoved = Array.isArray(value?.customProviders) && value.customProviders.some((provider) => provider &&
    `custom:${provider.id}` === value.providerId && !supportedProtocol(provider));
  const firstEnabled = customProviders.find((provider) => provider.enabled);
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    floatingBallTransparency: normalizeFloatingBallTransparency(value?.floatingBallTransparency),
    customProviders,
    ...(selectedWasRemoved ? {
      providerId: firstEnabled ? `custom:${firstEnabled.id}` : DEFAULT_SETTINGS.providerId,
      // Never silently auto-send pages to a different service during migration.
      autoTranslate: false,
      autoFallback: false
    } : {})
  } as Settings;
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  const normalized = normalizeSettings(value);
  if (Array.isArray(value?.customProviders) && value.customProviders.some((provider) => provider && !supportedProtocol(provider))) {
    await browser.storage.local.set({ [SETTINGS_KEY]: normalized });
  }
  return normalized;
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const normalized = normalizeSettings(settings);
  await browser.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}
