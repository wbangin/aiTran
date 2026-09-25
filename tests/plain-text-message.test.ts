import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { translatePlainText, translateTextPieces, splitSubtitleText } from '../src/core/plain-text';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { RuntimeMessage } from '../src/shared/types';

vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage: vi.fn() } } }));

const sendMessage = vi.mocked(browser.runtime.sendMessage);

beforeEach(() => {
  sendMessage.mockReset();
  sendMessage.mockImplementation(async (rawMessage: unknown) => {
    const message = rawMessage as RuntimeMessage;
    return {
      translations: message.type === 'TRANSLATE_BATCH' ? message.request.texts.map((text) => `译：${text}`) : []
    };
  });
});

describe('plain text translation requests', () => {
  it('passes document scene and context through to the provider request', async () => {
    await translatePlainText('Hello world.', DEFAULT_SETTINGS, undefined, 'document', { title: 'manual.pdf' });
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'TRANSLATE_BATCH',
      request: {
        texts: ['Hello world.'],
        sourceLanguage: 'auto',
        targetLanguage: 'zh-CN',
        providerId: 'microsoft',
        scene: 'document',
        context: { title: 'manual.pdf' }
      }
    });
  });

  it('passes subtitle scene while preserving subtitle metadata', async () => {
    const result = await translateTextPieces(
      splitSubtitleText('1\n00:00:01,000 --> 00:00:03,000\nHello world\n'),
      DEFAULT_SETTINGS,
      undefined,
      'subtitle',
      { title: 'captions.srt' }
    );
    expect(result).toContain('00:00:01,000 --> 00:00:03,000');
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ scene: 'subtitle', context: { title: 'captions.srt' } })
    }));
  });
});
