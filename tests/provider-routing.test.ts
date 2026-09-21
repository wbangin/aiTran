import { describe, expect, it } from 'vitest';
import { providerIdForInteractiveScene } from '../src/shared/provider-routing';

const scenes = ['selection', 'hover', 'input'] as const;

describe('interactive provider routing', () => {
  it.each(['google', 'microsoft'] as const)('keeps the free webpage provider %s', (providerId) => {
    scenes.forEach((scene) => {
      expect(providerIdForInteractiveScene({ providerId }, scene)).toBe(providerId);
    });
  });

  it('keeps the exact custom API selected for webpage translation', () => {
    const providerId = 'custom:my-openai-api' as const;
    scenes.forEach((scene) => {
      expect(providerIdForInteractiveScene({ providerId }, scene)).toBe(providerId);
    });
  });
});
