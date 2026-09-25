import type { CustomProviderConfig, Settings } from './types';

export const MAX_SUMMARY_CHARACTERS = 24_000;

export function summaryProviders(settings: Settings): CustomProviderConfig[] {
  return settings.customProviders.filter((provider) =>
    provider.enabled && provider.protocol === 'openai-compatible' && Boolean(provider.model.trim())
  );
}
