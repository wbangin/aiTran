import { describe, expect, it } from 'vitest';
import { assertNoBundledSecrets } from '../scripts/release-safety.mjs';

describe('release credential guard', () => {
  it('allows empty key defaults and runtime references', () => {
    expect(() => assertNoBundledSecrets('apiKey:""; headers.authorization = config.apiKey;', 'test.js')).not.toThrow();
  });
  it.each(['apiKey:"dummy-test-key"', '"apiKey":"dummy-test-key"', `token="sk-${'x'.repeat(30)}"`, '-----BEGIN PRIVATE KEY-----'])('rejects credential-shaped content without logging it', (content) => {
    try {
      assertNoBundledSecrets(content, 'test.js');
      throw new Error('Expected guard to reject content');
    } catch (error) {
      expect(error.message).toContain('value redacted');
      expect(error.message).not.toContain(content);
    }
  });
});
