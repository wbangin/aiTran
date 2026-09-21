import { browser } from 'wxt/browser';
import { collectTranslationBlocks, createBatches, normalizeText, restoreProtectedText, type TranslationBlock } from './dom';
import { errorMessage } from '../shared/errors';
import type { PageStatus, RuntimeMessage, Settings, TranslateResult } from '../shared/types';
import { InteractiveTranslator } from './interactive-translator';
import { applyDisplayMode, insertTranslationForMode, restoreHiddenOriginals } from './display-mode';

const TRANSLATION_CLASS = 'aitran-translation';

function installStyles(): void {
  if (document.getElementById('aitran-content-styles')) return;
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
    .${TRANSLATION_CLASS}[data-aitran-placement="inside"] {
      flex-basis: 100% !important;
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
  document.documentElement.append(style);
}

function renderTranslation(block: TranslationBlock, translation: string, settings: Settings): boolean {
  if (!block.element.isConnected || block.element.dataset.aitranTranslated === 'true') return false;
  const restoredTranslation = restoreProtectedText(translation, block.protectedFragments);
  const normalizedTranslation = normalizeText(restoredTranslation);
  const restoredSource = restoreProtectedText(block.text, block.protectedFragments);
  if (!normalizedTranslation || normalizedTranslation === normalizeText(restoredSource)) {
    block.element.dataset.aitranTranslated = 'true';
    block.element.dataset.aitranState = 'translated';
    return false;
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
  return true;
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

  getStatus(): PageStatus {
    return { ...this.status };
  }

  syncGlobalStatus(status: PageStatus): void {
    this.interactions?.setPageTranslated(status.translated);
  }

  private updateTranslatedState(): void {
    const renderedBlocks = document.querySelectorAll(`.${TRANSLATION_CLASS}`).length;
    this.status.translatedBlocks = Math.max(this.status.translatedBlocks, renderedBlocks);
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
    installStyles();
    this.status = { translated: false, translating: true, translatedBlocks: 0, totalBlocks: 0 };
    this.reportStatus();

    try {
      const settings = await this.getSettings();
      this.ensureInteractions(settings);
      await this.translateNewBlocks(settings);
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
    this.stopObserver();
    restoreHiddenOriginals(document);
    document.querySelectorAll<HTMLElement>(`.${TRANSLATION_CLASS}`).forEach((element) => element.remove());
    document.querySelectorAll<HTMLElement>('[data-aitran-translated="true"], [data-aitran-state]').forEach((element) => {
      element.removeAttribute('data-aitran-translated');
      element.removeAttribute('data-aitran-state');
    });
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
    applyDisplayMode(document, settings.displayMode);
    if (this.status.translated) this.startObserver(settings);
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
        () => browser.runtime.sendMessage({ type: 'TOGGLE_ACTIVE_PAGE' } satisfies RuntimeMessage)
      );
    } else this.interactions.applySettings(settings);
  }

  private async getSettings(): Promise<Settings> {
    return await browser.runtime.sendMessage({ type: 'GET_SETTINGS' } satisfies RuntimeMessage) as Settings;
  }

  private async translateNewBlocks(settings: Settings): Promise<void> {
    const blocks = collectTranslationBlocks();
    if (!blocks.length) return;
    this.status.totalBlocks += blocks.length;

    for (const batch of createBatches(blocks)) {
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

        result.translations.forEach((translation, index) => {
          const block = batch[index];
          if (!block) return;
          if (renderTranslation(block, translation, { ...settings, providerId: result.providerId })) {
            this.status.translatedBlocks += 1;
          }
        });
        this.updateTranslatedState();
        this.reportStatus();
      } catch (error) {
        batch.forEach((block) => block.element.removeAttribute('data-aitran-state'));
        throw error;
      }
    }
  }

  private startObserver(settings: Settings): void {
    this.stopObserver();
    this.observer = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) =>
        node.nodeType === Node.TEXT_NODE || (node instanceof Element && !node.closest('.aitran-translation') && !node.closest('[data-aitran-ui]'))
      ))) return;

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
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private stopObserver(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    window.clearTimeout(this.mutationTimer);
  }
}
