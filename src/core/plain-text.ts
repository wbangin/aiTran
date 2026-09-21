import { browser } from 'wxt/browser';
import type { PlainTextProgress, PromptContext, RuntimeMessage, Settings, TranslateResult, TranslationScene } from '../shared/types';

export interface TextPiece {
  text: string;
  separator: string;
  translatable: boolean;
}

const MAX_SEGMENT_LENGTH = 1600;

function splitLongText(text: string, maxLength = MAX_SEGMENT_LENGTH): string[] {
  if (text.length <= maxLength) return [text];
  const sentences = text.split(/(?<=[.!?。！？；;])\s*/u).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences.length ? sentences : [text]) {
    if (sentence.length > maxLength) {
      if (current) chunks.push(current);
      for (let i = 0; i < sentence.length; i += maxLength) chunks.push(sentence.slice(i, i + maxLength));
      current = '';
    } else if (!current || current.length + sentence.length + 1 <= maxLength) {
      current = current ? `${current} ${sentence}` : sentence;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function splitPlainText(text: string): TextPiece[] {
  const parts = text.split(/(\n{2,})/);
  const pieces: TextPiece[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (/^\n+$/.test(part)) {
      if (pieces.length) pieces[pieces.length - 1]!.separator += part;
      continue;
    }
    const normalized = part.trim();
    const leading = part.slice(0, part.indexOf(normalized));
    const trailingStart = part.lastIndexOf(normalized) + normalized.length;
    const trailing = part.slice(trailingStart);
    if (leading && pieces.length) pieces[pieces.length - 1]!.separator += leading;
    const chunks = splitLongText(normalized);
    chunks.forEach((chunk, index) => pieces.push({
      text: chunk,
      separator: index === chunks.length - 1 ? trailing : ' ',
      translatable: /[\p{L}\p{M}]/u.test(chunk)
    }));
  }
  return pieces;
}

export function splitSubtitleText(text: string): TextPiece[] {
  return text.split(/(\r?\n)/).reduce<TextPiece[]>((pieces, part) => {
    if (part === '') return pieces;
    if (part === '\n' || part === '\r\n') {
      if (pieces.length) pieces[pieces.length - 1]!.separator += part;
      return pieces;
    }
    const trimmed = part.trim();
    const isMetadata = !trimmed
      || /^\d+$/.test(trimmed)
      || /^WEBVTT/i.test(trimmed)
      || /^NOTE\b/i.test(trimmed)
      || /^(?:\d{2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->/i.test(trimmed);
    pieces.push({ text: part, separator: '', translatable: !isMetadata && /[\p{L}\p{M}]/u.test(trimmed) });
    return pieces;
  }, []);
}

export async function translateTextPieces(
  pieces: TextPiece[],
  settings: Settings,
  onProgress?: (progress: PlainTextProgress) => void,
  scene: TranslationScene = 'text',
  context?: PromptContext
): Promise<string> {
  const indexes = pieces.map((piece, index) => piece.translatable ? index : -1).filter((index) => index >= 0);
  const translated = new Map<number, string>();
  const batchSize = 16;
  let completed = 0;

  for (let offset = 0; offset < indexes.length; offset += batchSize) {
    const batchIndexes = indexes.slice(offset, offset + batchSize);
    const result = await browser.runtime.sendMessage({
      type: 'TRANSLATE_BATCH',
      request: {
        texts: batchIndexes.map((index) => pieces[index]!.text),
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        providerId: settings.providerId
      }
    } satisfies RuntimeMessage) as TranslateResult;
    batchIndexes.forEach((pieceIndex, resultIndex) => translated.set(pieceIndex, result.translations[resultIndex] ?? pieces[pieceIndex]!.text));
    completed += batchIndexes.length;
    onProgress?.({ completed, total: indexes.length });
  }

  return pieces.map((piece, index) => `${translated.get(index) ?? piece.text}${piece.separator}`).join('');
}

export async function translatePlainText(
  text: string,
  settings: Settings,
  onProgress?: (progress: PlainTextProgress) => void,
  scene: TranslationScene = 'text',
  context?: PromptContext
): Promise<string> {
  return await translateTextPieces(splitPlainText(text), settings, onProgress);
}
