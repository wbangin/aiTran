import { browser } from 'wxt/browser';
import { collectTranslationBlocks, createBatches, normalizeText, restoreProtectedText, sourceTextForElement, translationRoots, type TranslationBlock } from './dom';
import { errorMessage } from '../shared/errors';
import type { PageStatus, RuntimeMessage, Settings, TranslateResult } from '../shared/types';
import { InteractiveTranslator } from './interactive-translator';
import { applyDisplayMode, insertTranslationForMode, restoreHiddenOriginals, restoreOriginalDisplay } from './display-mode';

const TRANSLATION_CLASS = 'aitran-translation';

function installStyles(root: ParentNode = document): void {
  if (root.querySelector('#aitran-content-styles')) return;
  const style = document.createElement('style');
  style.id = 'aitran-content-styles';
  style.dataset.aitranUi = 'true';
  style.textContent = `
    .${TRANSLATION_CLASS} {
      all: revert !important;
      box-sizing: border-box !important;
      display: block !important;
      position: static !important;
      float: none !important;
      clear: both !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: 100% !important;
      height: auto !important;
      margin: 0.38em 0 0.18em !important;
      padding: 0.38em 0.62em !important;
      border: 1px solid rgba(99, 102, 241, 0.13) !important;
      border-radius: 0.48em !important;
      color: #4b50a8 !important;
      background: rgba(99, 102, 241, 0.055) !important;
      box-shadow: none !important;
      font-family: inherit !important;
      font-size: 0.92em !important;
      font-style: normal !important;
      font-weight: 400 !important;
      letter-spacing: normal !important;
      line-height: 1.58 !important;
      text-align: start !important;
      text-decoration: none !important;
      text-indent: 0 !important;
      text-transform: none !important;
      white-space: pre-wrap !important;
      overflow: visible !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
      opacity: 0.96 !important;
      pointer-events: auto !important;
    }
    .${TRANSLATION_CLASS}[data-aitran-kind="heading"] {
      font-size: 0.78em !important;
      font-weight: 500 !important;
    }
    .${TRANSLATION_CLASS}[data-aitran-kind="compact"] {
      margin: 0.18em 0 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      color: #5961bd !important;
      background: transparent !important;
      font-size: 0.82em !important;
      line-height: 1.38 !important;
      opacity: 0.9 !important;
    }
    .${TRANSLATION_CLASS}[data-aitran-mode="translation-only"] {
      margin-top: 0 !important;
      color: inherit !important;
      background: transparent !important;
      border-color: transparent !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      font-size: inherit !important;
    }
    @media (prefers-color-scheme: dark) {
      .${TRANSLATION_CLASS} {
        color: #c2c7ff !important;
        background: rgba(129, 140, 248, 0.095) !important;
        border-color: rgba(165, 180, 252, 0.16) !important;
      }
      .${TRANSLATION_CLASS}[data-aitran-mode="translation-only"] {
        color: inherit !important;
        background: transparent !important;
        border-color: transparent !important;
      }
    }
  `;
  if (root instanceof ShadowRoot) root.append(style);
  else document.documentElement.append(style);
}

function renderTranslation(block: TranslationBlock, translation: string, settings: Settings): HTMLElement | undefined {
  if (!block.element.isConnected || block.element.dataset.aitranTranslated === 'true') return undefined;
  const restoredTranslation = restoreProtectedText(translation, block.protectedFragments);
  const normalizedTranslation = normalizeText(restoredTranslation);
  const restoredSource = restoreProtectedText(block.text, block.protectedFragments);
  if (!normalizedTranslation || normalizedTranslation === normalizeText(restoredSource)) {
    block.element.dataset.aitranTranslated = 'true';
    block.element.dataset.aitranState = 'translated';
    return undefined;
  }

  const translated = document.createElement('span');
  translated.className = TRANSLATION_CLASS;
  translated.dataset.aitranUi = 'true';
  translated.dataset.aitranProvider = settings.providerId;
  translated.dataset.aitranKind = block.kind;
  translated.setAttribute('lang', settings.targetLanguage);
  translated.textContent = restoredTranslation.trim();

  block.element.dataset.aitranTranslated = 'true';
  insertTranslationForMode(block.element, translated, block.placement, settings.displayMode);
  block.element.dataset.aitranState = 'translated';
  return translated;
}

export class PageTranslator {
  private status: PageStatus = {
    translated: false,
    translating: false,
    translatedBlocks: 0,
    totalBlocks: 0
  };
  private observer?: MutationObserver;
  private mutationTimer?: number;
  private interactions?: InteractiveTranslator;
  private sourceSnapshots = new WeakMap<HTMLElement, string>();
  private translations = new WeakMap<HTMLElement, HTMLElement>();
  private translatingNewBlocks = false;
  private rescanRequested = false;
  private latestSettings?: Settings;
  private generation = 0;

  getStatus(): PageStatus {
    return { ...this.status };
  }

  syncGlobalStatus(status: PageStatus): void {
    this.interactions?.setPageTranslated(status.translated, status.translating);
  }

  private updateTranslatedState(): void {
    const renderedBlocks = translationRoots().reduce((count, root) => count + root.querySelectorAll(`.${TRANSLATION_CLASS}`).length, 0);
    this.status.translatedBlocks = renderedBlocks;
    this.status.translated = this.status.translatedBlocks > 0;
    this.interactions?.setPageTranslated(this.status.translated);
  }

  async reportCurrentStatus(): Promise<PageStatus> {
    try {
      return await browser.runtime.sendMessage({
        type: 'REPORT_PAGE_STATUS',
        status: this.getStatus()
      } satisfies RuntimeMessage) as PageStatus;
    } catch {
      return this.getStatus();
    }
  }

  private reportStatus(): void {
    void this.reportCurrentStatus();
  }

  async translatePage(): Promise<PageStatus> {
    if (this.status.translating) return this.getStatus();
    const generation = this.generation;
    installStyles();
    this.status = { translated: false, translating: true, translatedBlocks: 0, totalBlocks: 0 };
    this.reportStatus();

    try {
      const settings = await this.getSettings();
      this.ensureInteractions(settings);
      await this.translateNewBlocks(settings);
      if (generation !== this.generation) return this.getStatus();
      this.updateTranslatedState();
      this.startObserver(settings);
    } catch (error) {
      this.status.error = errorMessage(error);
    } finally {
      this.updateTranslatedState();
      this.status.translating = false;
      this.reportStatus();
    }
    return this.getStatus();
  }

  restorePage(): PageStatus {
    this.generation += 1;
    this.rescanRequested = false;
    this.stopObserver();
    for (const root of translationRoots()) {
      restoreHiddenOriginals(root);
      root.querySelectorAll<HTMLElement>(`.${TRANSLATION_CLASS}`).forEach((element) => element.remove());
      root.querySelectorAll<HTMLElement>('[data-aitran-translated="true"], [data-aitran-state]').forEach((element) => {
        element.removeAttribute('data-aitran-translated');
        element.removeAttribute('data-aitran-state');
      });
    }
    this.sourceSnapshots = new WeakMap();
    this.translations = new WeakMap();
    this.status = { translated: false, translating: false, translatedBlocks: 0, totalBlocks: 0 };
    this.interactions?.setPageTranslated(false);
    this.reportStatus();
    return this.getStatus();
  }

  async togglePage(): Promise<PageStatus> {
    return this.status.translated ? this.restorePage() : this.translatePage();
  }

  async initialize(): Promise<void> {
    const settings = await this.getSettings();
    this.ensureInteractions(settings);
    this.updateTranslatedState();
    this.reportStatus();
    if (settings.autoTranslate) await this.translatePage();
  }

  async refreshSettings(): Promise<void> {
    const settings = await this.getSettings();
    this.ensureInteractions(settings);
    this.interactions?.applySettings(settings);
    for (const root of translationRoots()) applyDisplayMode(root, settings.displayMode);
    if (this.observer) this.startObserver(settings);
  }

  async translateInput(): Promise<{ ok: boolean; message: string }> {
    if (!this.interactions) await this.refreshSettings();
    return await this.interactions!.translateInput();
  }

  async translateContextSelection(text: string): Promise<void> {
    if (!this.interactions) await this.refreshSettings();
    await this.interactions!.showContextSelection(text);
  }

  private ensureInteractions(settings: Settings): void {
    if (!this.interactions) {
      this.interactions = new InteractiveTranslator(
        settings,
        () => browser.runtime.sendMessage({ type: 'TOGGLE_ACTIVE_PAGE' } satisfies RuntimeMessage),
        () => browser.runtime.sendMessage({ type: 'OPEN_ACTIVE_PAGE_SUMMARY' } satisfies RuntimeMessage)
      );
    } else this.interactions.applySettings(settings);
  }

  private async getSettings(): Promise<Settings> {
    return await browser.runtime.sendMessage({ type: 'GET_SETTINGS' } satisfies RuntimeMessage) as Settings;
  }

  private async translateNewBlocks(settings: Settings): Promise<void> {
    this.latestSettings = settings;
    if (this.translatingNewBlocks) {
      this.rescanRequested = true;
      return;
    }
    this.translatingNewBlocks = true;
    try {
      do {
        this.rescanRequested = false;
        await this.translateCollectedBlocks(this.latestSettings!);
      } while (this.rescanRequested);
    } finally {
      this.translatingNewBlocks = false;
    }
  }

  private async translateCollectedBlocks(settings: Settings): Promise<void> {
    for (const root of translationRoots()) if (root instanceof ShadowRoot) installStyles(root);
    const blocks = collectTranslationBlocks();
    if (!blocks.length) return;
    this.status.totalBlocks += blocks.length;
    const generation = this.generation;

    for (const batch of createBatches(blocks)) {
      if (generation !== this.generation) return;
      const sourceTexts = batch.map((block) => sourceTextForElement(block.element));
      batch.forEach((block) => { block.element.dataset.aitranState = 'pending'; });
      try {
        const result = await browser.runtime.sendMessage({
          type: 'TRANSLATE_BATCH',
          request: {
            texts: batch.map((block) => block.text),
            sourceLanguage: settings.sourceLanguage,
            targetLanguage: settings.targetLanguage,
            providerId: settings.providerId,
            scene: 'page',
            context: { title: document.title }
          }
        } satisfies RuntimeMessage) as TranslateResult;

        if (generation !== this.generation) return;
        result.translations.forEach((translation, index) => {
          const block = batch[index];
          if (!block) return;
          if (sourceTextForElement(block.element) !== sourceTexts[index]) {
            block.element.removeAttribute('data-aitran-state');
            this.rescanRequested = true;
            return;
          }
          const translated = renderTranslation(block, translation, { ...settings, providerId: result.providerId });
          if (translated) this.translations.set(block.element, translated);
          this.sourceSnapshots.set(block.element, sourceTextForElement(block.element));
        });
        this.updateTranslatedState();
        this.reportStatus();
      } catch (error) {
        batch.forEach((block) => block.element.removeAttribute('data-aitran-state'));
        throw error;
      }
    }
  }

  private invalidateOriginal(original: HTMLElement): void {
    restoreOriginalDisplay(original);
    this.translations.get(original)?.remove();
    this.translations.delete(original);
    this.sourceSnapshots.delete(original);
    original.removeAttribute('data-aitran-translated');
    original.removeAttribute('data-aitran-state');
    this.updateTranslatedState();
  }

  private startObserver(settings: Settings): void {
    this.stopObserver();
    const observedRoots = new Set<ParentNode>();
    const observeRoots = () => {
      for (const root of translationRoots()) {
        if (observedRoots.has(root)) continue;
        this.observer?.observe(root, { childList: true, characterData: true, subtree: true });
        observedRoots.add(root);
      }
    };
    this.observer = new MutationObserver((mutations) => {
      let relevant = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.removedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches('[data-aitran-translated="true"]')) this.invalidateOriginal(node);
            node.querySelectorAll<HTMLElement>('[data-aitran-translated="true"]').forEach((original) => this.invalidateOriginal(original));
          }
        }
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (!target || target.closest('.aitran-translation, [data-aitran-ui]')) continue;
        if (mutation.type === 'childList' && [...mutation.addedNodes, ...mutation.removedNodes].every((node) =>
          node instanceof Element && node.matches('.aitran-translation, [data-aitran-ui]')
        )) continue;
        relevant = true;
        const original = target.closest<HTMLElement>('[data-aitran-translated="true"]');
        if (original && this.sourceSnapshots.get(original) !== sourceTextForElement(original)) this.invalidateOriginal(original);
      }
      if (!relevant) return;

      observeRoots();

      window.clearTimeout(this.mutationTimer);
      this.mutationTimer = window.setTimeout(() => {
        void this.translateNewBlocks(settings).then(() => {
          this.updateTranslatedState();
          this.reportStatus();
        }).catch((error) => {
          this.status.error = errorMessage(error);
          this.reportStatus();
        });
      }, 700);
    });
    observeRoots();
  }

  private stopObserver(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    window.clearTimeout(this.mutationTimer);
  }
}
