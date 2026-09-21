import { AiTranError } from '../shared/errors';
import type { ProviderId, Settings, TranslationProvider } from '../shared/types';
import { CustomProvider } from './custom';
import { GoogleProvider } from './google';
import { MicrosoftProvider } from './microsoft';

export function createProvider(providerId: ProviderId, settings: Settings): TranslationProvider {
  if (providerId === 'google') return new GoogleProvider();
  if (providerId === 'microsoft') return new MicrosoftProvider();

  if (providerId.startsWith('custom:')) {
    const id = providerId.slice('custom:'.length);
    const config = settings.customProviders.find((provider) => provider.id === id && provider.enabled);
    if (!config) throw new AiTranError('找不到或未启用该自定义翻译服务', 'PROVIDER_NOT_FOUND');
    return new CustomProvider(config);
  }

  throw new AiTranError(`Unsupported provider: ${providerId}`, 'PROVIDER_NOT_FOUND');
}

export function fallbackProviderId(providerId: ProviderId): ProviderId | undefined {
  if (providerId === 'google') return 'microsoft';
  if (providerId === 'microsoft') return 'google';
  return undefined;
}
