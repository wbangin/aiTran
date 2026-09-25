import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import type { RuntimeMessage } from '../src/shared/types';
import { PageTranslator } from '../src/core/page-translator';
import { PageSummaryPanel } from '../src/ui/page-summary';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  runAt: 'document_idle',
  main() {
    const translator = new PageTranslator();
    const summaryPanel = window.self === window.top ? new PageSummaryPanel() : undefined;

    browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
      switch (message.type) {
        case 'OPEN_PAGE_SUMMARY':
          if (!summaryPanel) return undefined;
          summaryPanel.open();
          return Promise.resolve({ ok: true });
        case 'GET_PAGE_STATUS':
          return Promise.resolve(translator.getStatus());
        case 'REQUEST_PAGE_STATUS_REPORT':
          return translator.reportCurrentStatus();
        case 'SYNC_PAGE_STATUS':
          translator.syncGlobalStatus(message.status);
          return Promise.resolve({ ok: true });
        case 'TRANSLATE_PAGE':
          return translator.translatePage();
        case 'RESTORE_PAGE':
          return Promise.resolve(translator.restorePage());
        case 'TOGGLE_PAGE':
          return translator.togglePage();
        case 'REFRESH_SETTINGS':
          return translator.refreshSettings().then(() => ({ ok: true }));
        case 'TRANSLATE_INPUT':
          return translator.translateInput();
        case 'TRANSLATE_CONTEXT_SELECTION':
          return translator.translateContextSelection(message.text).then(() => ({ ok: true }));
        default:
          return undefined;
      }
    });

    void translator.initialize();
  }
});
