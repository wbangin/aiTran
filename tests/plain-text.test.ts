import { describe, expect, it } from 'vitest';
import { splitPlainText, splitSubtitleText } from '../src/core/plain-text';

describe('plain text splitting', () => {
  it('preserves paragraph separators', () => {
    const pieces = splitPlainText('Hello world.\n\nSecond paragraph.');
    expect(pieces.map((piece) => piece.text)).toEqual(['Hello world.', 'Second paragraph.']);
    expect(pieces[0]?.separator).toBe('\n\n');
  });

  it('splits long content into provider-safe pieces', () => {
    const pieces = splitPlainText('A'.repeat(3400));
    expect(pieces.length).toBe(3);
    expect(pieces.every((piece) => piece.text.length <= 1600)).toBe(true);
  });

  it('keeps SRT metadata out of translation', () => {
    const pieces = splitSubtitleText('1\n00:00:01,000 --> 00:00:03,000\nHello world\n');
    expect(pieces.map((piece) => piece.translatable)).toEqual([false, false, true]);
    expect(pieces.map((piece) => `${piece.text}${piece.separator}`).join('')).toBe('1\n00:00:01,000 --> 00:00:03,000\nHello world\n');
  });
});
