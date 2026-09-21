import type { ProviderId, Settings, TranslationScene } from './types';

/**
 * Interactive translation follows the same provider selected for webpage translation.
 * This intentionally applies to free providers and custom APIs alike.
 */
export function providerIdForInteractiveScene(
  settings: Pick<Settings, 'providerId'>,
  _scene: Extract<TranslationScene, 'selection' | 'hover' | 'input'>
): ProviderId {
  return settings.providerId;
}
