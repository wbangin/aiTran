// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyDisplayMode, insertTranslationForMode, restoreHiddenOriginals } from '../src/core/display-mode';

beforeEach(() => {
  document.body.innerHTML = '';
});

function createTranslation(): HTMLSpanElement {
  const translation = document.createElement('span');
  translation.className = 'aitran-translation';
  translation.textContent = '译文';
  return translation;
}

describe('page display modes', () => {
  it('hides and restores an original for after-placement translations', () => {
    const original = document.createElement('p');
    original.dataset.aitranTranslated = 'true';
    original.style.setProperty('display', 'inline-block', 'important');
    const translation = createTranslation();
    document.body.append(original);

    insertTranslationForMode(original, translation, 'after', 'translation-only');
    expect(original.style.getPropertyValue('display')).toBe('none');
    expect(original.style.getPropertyPriority('display')).toBe('important');
    expect(translation.previousElementSibling).toBe(original);
    expect(translation.dataset.aitranMode).toBe('translation-only');

    applyDisplayMode(document, 'bilingual');
    expect(original.style.getPropertyValue('display')).toBe('inline-block');
    expect(original.style.getPropertyPriority('display')).toBe('important');
    expect(translation.previousElementSibling).toBe(original);
    expect(translation.dataset.aitranMode).toBeUndefined();
  });

  it('moves inside translations out before hiding and puts them back for bilingual mode', () => {
    const original = document.createElement('div');
    original.dataset.aitranTranslated = 'true';
    const translation = createTranslation();
    document.body.append(original);

    insertTranslationForMode(original, translation, 'inside', 'bilingual');
    expect(translation.parentElement).toBe(original);

    applyDisplayMode(document, 'translation-only');
    expect(original.style.getPropertyValue('display')).toBe('none');
    expect(translation.parentElement).toBe(document.body);
    expect(translation.previousElementSibling).toBe(original);

    applyDisplayMode(document, 'bilingual');
    expect(original.style.getPropertyValue('display')).toBe('');
    expect(translation.parentElement).toBe(original);
  });

  it('restores hidden originals before translations are removed', () => {
    const original = document.createElement('p');
    original.dataset.aitranTranslated = 'true';
    const translation = createTranslation();
    document.body.append(original);
    insertTranslationForMode(original, translation, 'after', 'translation-only');

    restoreHiddenOriginals(document);
    expect(original.style.getPropertyValue('display')).toBe('');
    expect(original.dataset.aitranOriginalDisplay).toBeUndefined();
  });
});
