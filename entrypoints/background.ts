import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { translateBatch } from '../src/core/translation-service';
import { summarizePageContent } from '../src/core/summary-service';
import { CustomProvider } from '../src/providers/custom';
import { aggregatePageStatuses, EMPTY_PAGE_STATUS, pageActionForStatus } from '../src/core/page-status';
import { errorMessage } from '../src/shared/errors';
import type { PageStatus, RuntimeMessage } from '../src/shared/types';
import { getSettings, saveSettings } from '../src/storage/settings';

const MENU_TRANSLATE_PAGE = 'aitran-translate-page';
const MENU_TRANSLATE_SELECTION = 'aitran-translate-selection';
const MENU_TRANSLATE_INPUT = 'aitran-translate-input';
const MENU_TEXT_TRANSLATOR = 'aitran-text-translator';
const MENU_SUMMARIZE_PAGE = 'aitran-summarize-page';
const OPTIMISTIC_FRAME_ID = -1;
const frameStatuses = new Map<number, Map<number, PageStatus>>();

async function activeTabId(): Promise<number | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function sendToTab(tabId: number | undefined, message: RuntimeMessage): Promise<unknown> {
  if (tabId === undefined) return undefined;
  try {
    return await browser.tabs.sendMessage(tabId, message);
  } catch {
    return undefined;
  }
}

function getTabStatus(tabId: number): PageStatus {
  return aggregatePageStatuses(frameStatuses.get(tabId)?.values() ?? []);
}

async function refreshTabStatus(tabId: number): Promise<PageStatus> {
  frameStatuses.set(tabId, new Map());
  const response = await sendToTab(tabId, { type: 'REQUEST_PAGE_STATUS_REPORT' });
  await new Promise((resolve) => setTimeout(resolve, 40));
  const status = getTabStatus(tabId);
  if (response === undefined && frameStatuses.get(tabId)?.size === 0) {
    return { ...EMPTY_PAGE_STATUS, error: '此页面不允许扩展运行' };
  }
  return status;
}

async function publishTabStatus(tabId: number): Promise<PageStatus> {
  const status = getTabStatus(tabId);
  await Promise.allSettled([
    browser.tabs.sendMessage(tabId, { type: 'SYNC_PAGE_STATUS', status } satisfies RuntimeMessage, { frameId: 0 }),
    browser.runtime.sendMessage({ type: 'PAGE_STATUS_CHANGED', tabId, status } satisfies RuntimeMessage)
  ]);
  return status;
}

async function recordFrameStatus(tabId: number, frameId: number, status: PageStatus): Promise<PageStatus> {
  let statuses = frameStatuses.get(tabId);
  if (!statuses) {
    statuses = new Map();
    frameStatuses.set(tabId, statuses);
  }
  statuses.delete(OPTIMISTIC_FRAME_ID);
  statuses.set(frameId, status);
  return await publishTabStatus(tabId);
}

async function toggleTabPage(tabId: number): Promise<PageStatus> {
  const current = await refreshTabStatus(tabId);
  const action = pageActionForStatus(current);
  if (action === 'blocked') return current;

  if (action === 'restore') {
    frameStatuses.set(tabId, new Map());
    await publishTabStatus(tabId);
    await sendToTab(tabId, { type: 'RESTORE_PAGE' });
  } else {
    frameStatuses.set(tabId, new Map([[OPTIMISTIC_FRAME_ID, {
      ...EMPTY_PAGE_STATUS,
      translating: true
    }]]));
    await publishTabStatus(tabId);
    await sendToTab(tabId, { type: 'TRANSLATE_PAGE' });
  }

  return getTabStatus(tabId);
}

function createContextMenus(): void {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({ id: MENU_TRANSLATE_PAGE, title: 'aiTran：翻译网页 / 显示原文', contexts: ['page'] });
    browser.contextMenus.create({ id: MENU_SUMMARIZE_PAGE, title: 'aiTran：AI 总结当前网页', contexts: ['page'] });
    browser.contextMenus.create({ id: MENU_TRANSLATE_SELECTION, title: 'aiTran：翻译选中文本', contexts: ['selection'] });
    browser.contextMenus.create({ id: MENU_TRANSLATE_INPUT, title: 'aiTran：翻译输入框', contexts: ['editable'] });
    browser.contextMenus.create({ id: MENU_TEXT_TRANSLATOR, title: 'aiTran：打开文本翻译', contexts: ['page', 'selection'] });
  }).catch(() => undefined);
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await getSettings();
    createContextMenus();
  });
  browser.runtime.onStartup.addListener(createContextMenus);
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') frameStatuses.delete(tabId);
  });
  browser.tabs.onRemoved.addListener((tabId) => frameStatuses.delete(tabId));

  browser.runtime.onMessage.addListener(async (message: RuntimeMessage, sender) => {
    switch (message.type) {
      case 'GET_SETTINGS':
        return await getSettings();
      case 'SAVE_SETTINGS':
        return await saveSettings(message.settings);
      case 'SET_DISPLAY_MODE': {
        if (!['bilingual', 'translation-only'].includes(message.displayMode)) throw new Error('无效显示模式');
        const settings = await saveSettings({ ...await getSettings(), displayMode: message.displayMode });
        const tabId = sender.tab?.id ?? await activeTabId();
        if (tabId !== undefined) await browser.tabs.sendMessage(tabId, { type: 'REFRESH_SETTINGS' } satisfies RuntimeMessage);
        return settings;
      }
      case 'OPEN_OPTIONS_PAGE':
        await browser.runtime.openOptionsPage();
        return { ok: true };
      case 'OPEN_ACTIVE_PAGE_SUMMARY': {
        const tabId = sender.tab?.id ?? await activeTabId();
        if (tabId === undefined) return { ok: false, error: '找不到当前标签页' };
        try {
          return await browser.tabs.sendMessage(tabId, { type: 'OPEN_PAGE_SUMMARY' } satisfies RuntimeMessage, { frameId: 0 });
        } catch {
          return { ok: false, error: '此页面暂时无法总结，请刷新网页后再试。浏览器内部页面不支持此功能。' };
        }
      }
      case 'SUMMARIZE_PAGE': {
        try {
          const result = await summarizePageContent(message.request, await getSettings());
          return { ok: true, ...result };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      }
      case 'GET_ACTIVE_PAGE_STATUS': {
        const tabId = await activeTabId();
        return tabId === undefined ? { ...EMPTY_PAGE_STATUS } : await refreshTabStatus(tabId);
      }
      case 'REPORT_PAGE_STATUS': {
        const tabId = sender.tab?.id;
        if (tabId === undefined) return message.status;
        return await recordFrameStatus(tabId, sender.frameId ?? 0, message.status);
      }
      case 'TOGGLE_ACTIVE_PAGE': {
        const tabId = sender.tab?.id ?? await activeTabId();
        return tabId === undefined ? { ...EMPTY_PAGE_STATUS } : await toggleTabPage(tabId);
      }
      case 'TRANSLATE_BATCH': {
        const settings = await getSettings();
        return await translateBatch(message.request, settings);
      }
      case 'TEST_CUSTOM_PROVIDER': {
        try {
          const provider = new CustomProvider(message.provider);
          const result = await provider.translate({
            texts: ['Hello'],
            sourceLanguage: 'en',
            targetLanguage: 'zh-CN',
            scene: 'test'
          });
          return { ok: true, translation: result.translations[0] };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      }
      default:
        return undefined;
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    const tabId = await activeTabId();
    if (command === 'toggleTranslation' && tabId !== undefined) await toggleTabPage(tabId);
    if (command === 'translateInput') await sendToTab(tabId, { type: 'TRANSLATE_INPUT' });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === MENU_TRANSLATE_PAGE && tab?.id !== undefined) await toggleTabPage(tab.id);
    if (info.menuItemId === MENU_SUMMARIZE_PAGE && tab?.id !== undefined) {
      await browser.tabs.sendMessage(tab.id, { type: 'OPEN_PAGE_SUMMARY' } satisfies RuntimeMessage, { frameId: 0 }).catch(() => undefined);
    }
    if (info.menuItemId === MENU_TRANSLATE_INPUT) await sendToTab(tab?.id, { type: 'TRANSLATE_INPUT' });
    if (info.menuItemId === MENU_TRANSLATE_SELECTION && info.selectionText) {
      await sendToTab(tab?.id, { type: 'TRANSLATE_CONTEXT_SELECTION', text: info.selectionText });
    }
    if (info.menuItemId === MENU_TEXT_TRANSLATOR) {
      const query = info.selectionText ? `?text=${encodeURIComponent(info.selectionText)}` : '';
      await browser.tabs.create({ url: browser.runtime.getURL(`/text-translate.html${query}`) });
    }
  });
});
