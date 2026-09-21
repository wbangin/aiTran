import type { DisplayMode } from '../shared/types';
import type { TranslationPlacement } from './dom';

const TRANSLATION_SELECTOR = '.aitran-translation';
const TRANSLATED_ORIGINAL_SELECTOR = '[data-aitran-translated="true"]';

function findOriginalElement(translation: HTMLElement): HTMLElement | undefined {
  const parent = translation.parentElement;
  if (parent instanceof HTMLElement && parent.matches(TRANSLATED_ORIGINAL_SELECTOR)) return parent;

  const previous = translation.previousElementSibling;
  if (previous instanceof HTMLElement && previous.matches(TRANSLATED_ORIGINAL_SELECTOR)) return previous;

  return undefined;
}

function rememberAndHideOriginal(original: HTMLElement): void {
  if (original.dataset.aitranOriginalDisplay === undefined) {
    original.dataset.aitranOriginalDisplay = original.style.getPropertyValue('display');
    original.dataset.aitranOriginalDisplayPriority = original.style.getPropertyPriority('display');
  }
  original.style.setProperty('display', 'none', 'important');
}

function restoreOriginalDisplay(original: HTMLElement): void {
  if (original.dataset.aitranOriginalDisplay === undefined) return;

  const display = original.dataset.aitranOriginalDisplay;
  const priority = original.dataset.aitranOriginalDisplayPriority ?? '';
  if (display) original.style.setProperty('display', display, priority);
  else original.style.removeProperty('display');
  original.removeAttribute('data-aitran-original-display');
  original.removeAttribute('data-aitran-original-display-priority');
}

function applyTranslationMode(translation: HTMLElement, original: HTMLElement, mode: DisplayMode): void {
  const placement = (translation.dataset.aitranPlacement ?? 'after') as TranslationPlacement;

  if (mode === 'translation-only') {
    if (translation.parentElement === original) original.insertAdjacentElement('afterend', translation);
    translation.dataset.aitranMode = 'translation-only';
    rememberAndHideOriginal(original);
    return;
  }

  restoreOriginalDisplay(original);
  translation.removeAttribute('data-aitran-mode');
  if (placement === 'inside') original.append(translation);
  else if (translation.previousElementSibling !== original) original.insertAdjacentElement('afterend', translation);
}

export function insertTranslationForMode(
  original: HTMLElement,
  translation: HTMLElement,
  placement: TranslationPlacement,
  mode: DisplayMode
): void {
  translation.dataset.aitranPlacement = placement;
  if (placement === 'inside') original.append(translation);
  else original.insertAdjacentElement('afterend', translation);
  applyTranslationMode(translation, original, mode);
}

export function applyDisplayMode(root: ParentNode, mode: DisplayMode): void {
  const translations = Array.from(root.querySelectorAll<HTMLElement>(TRANSLATION_SELECTOR));
  for (const translation of translations) {
    const original = findOriginalElement(translation);
    if (original) applyTranslationMode(translation, original, mode);
  }
}

export function restoreHiddenOriginals(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-aitran-original-display]').forEach(restoreOriginalDisplay);
}
