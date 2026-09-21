import { browser } from 'wxt/browser';
import './style.css';
import { LANGUAGES } from '../../src/shared/constants';
import { errorMessage } from '../../src/shared/errors';
import { isPageStatus, normalizePageStatus } from '../../src/core/page-status';
import { createShortcutLabels, loadShortcutLabels, type ShortcutLabels } from '../../src/shared/shortcuts';
import type { PageStatus, RuntimeMessage, Settings } from '../../src/shared/types';

const providerSelect = document.querySelector<HTMLSelectElement>('#provider')!;
const sourceSelect = document.querySelector<HTMLSelectElement>('#source-language')!;
const targetSelect = document.querySelector<HTMLSelectElement>('#target-language')!;
const translateButton = document.querySelector<HTMLButtonElement>('#translate')!;
const displayModeButton = document.querySelector<HTMLButtonElement>('#display-mode')!;
const optionsButton = document.querySelector<HTMLButtonElement>('#options')!;
const moreButton = document.querySelector<HTMLButtonElement>('#more')!;
const statusElement = document.querySelector<HTMLDivElement>('#status')!;
const hoverButton = document.querySelector<HTMLButtonElement>('#hover-translate')!;
const selectionButton = document.querySelector<HTMLButtonElement>('#selection-translate')!;
const floatingButton = document.querySelector<HTMLButtonElement>('#floating-ball')!;
const inputButton = document.querySelector<HTMLButtonElement>('#input-translate')!;
const textButton = document.querySelector<HTMLButtonElement>('#text-translate')!;
const documentButton = document.querySelector<HTMLButtonElement>('#document-translate')!;
const swapLanguagesButton = document.querySelector<HTMLButtonElement>('#swap-languages')!;
const inputShortcutElement = document.querySelector<HTMLElement>('#input-shortcut')!;
let settings: Settings;
let currentTabId: number | undefined;
let pageStatus: PageStatus = { translated: false, translating: false, translatedBlocks: 0, totalBlocks: 0 };
let shortcutLabels: ShortcutLabels = createShortcutLabels('other');

function setStatus(message: string, type: 'normal' | 'success' | 'error' = 'normal'): void {
  statusElement.textContent = message;
  statusElement.className = `status${type === 'normal' ? '' : ` ${type}`}`;
}

function addLanguageOptions(select: HTMLSelectElement, includeAuto: boolean): void {
  for (const [value, label] of LANGUAGES) {
    if (!includeAuto && value === 'auto') continue;
    select.add(new Option(label, value));
  }
}

function populateProviders(value: Settings): void {
  providerSelect.replaceChildren();
  const freeGroup = document.createElement('optgroup');
  freeGroup.label = '免费组';
  freeGroup.append(new Option('Microsoft Translate', 'microsoft'), new Option('Google Translate', 'google'));
  providerSelect.append(freeGroup);
  const enabled = value.customProviders.filter((provider) => provider.enabled);
  if (enabled.length) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = '自定义组';
    enabled.forEach((provider) => customGroup.append(new Option(provider.name, `custom:${provider.id}`)));
    providerSelect.append(customGroup);
  }
  providerSelect.value = value.providerId;
}

async function activeTabId(): Promise<number> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const id = tabs[0]?.id;
  if (id === undefined) throw new Error('找不到当前标签页');
  currentTabId = id;
  return id;
}

async function sendToPage<T>(message: RuntimeMessage): Promise<T> {
  return await browser.tabs.sendMessage(await activeTabId(), message) as T;
}

async function requestPageStatus(message: RuntimeMessage): Promise<PageStatus> {
  const response: unknown = await browser.runtime.sendMessage(message);
  if (!isPageStatus(response)) {
    throw new Error('扩展后台未响应，请在扩展管理页重新加载 aiTran 后再试');
  }
  return normalizePageStatus(response);
}

async function persistSettings(refreshPage = true): Promise<void> {
  settings = await browser.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings } satisfies RuntimeMessage) as Settings;
  if (refreshPage) await sendToPage({ type: 'REFRESH_SETTINGS' }).catch(() => undefined);
  renderFeatureStates();
}

async function saveQuickSettings(): Promise<void> {
  settings = {
    ...settings,
    providerId: providerSelect.value as Settings['providerId'],
    sourceLanguage: sourceSelect.value,
    targetLanguage: targetSelect.value
  };
  await persistSettings();
}

function renderTranslateButton(status: PageStatus): void {
  const label = status.translating ? '翻译中…' : status.translated ? '显示原文' : '翻译网页';
  const shortcut = document.createElement('kbd');
  shortcut.id = 'page-shortcut';
  shortcut.textContent = shortcutLabels.toggleTranslation;
  translateButton.replaceChildren(document.createTextNode(`${label} `), shortcut);
  translateButton.title = `网页翻译快捷键：${shortcutLabels.toggleTranslation}`;
}

function renderShortcutLabels(): void {
  inputShortcutElement.textContent = shortcutLabels.translateInput;
  inputButton.title = `输入框翻译快捷键：${shortcutLabels.translateInput}`;
  hoverButton.title = `按住 ${shortcutLabels.hoverModifier} 并悬停段落进行翻译`;
  renderTranslateButton(pageStatus);
}

function applyPageStatus(value: unknown): void {
  const status = normalizePageStatus(value, pageStatus);
  pageStatus = status;
  translateButton.classList.toggle('restore', status.translated);
  translateButton.disabled = status.translating;
  renderTranslateButton(status);
  if (status.error) setStatus(status.error, 'error');
  else if (status.translating) setStatus(`正在翻译 ${status.translatedBlocks}/${status.totalBlocks || '…'}`);
  else if (status.translated) setStatus(`已翻译 ${status.translatedBlocks} 个文本块`, 'success');
  else setStatus('选择翻译服务后即可开始');
}

function currentProviderName(): string {
  if (settings.providerId === 'google') return 'Google Translate';
  if (settings.providerId === 'microsoft') return 'Microsoft Translate';
  const provider = settings.customProviders.find((item) => `custom:${item.id}` === settings.providerId);
  return provider?.name || '自定义 API';
}

function renderFeatureStates(): void {
  hoverButton.classList.toggle('active', settings.hoverTranslation);
  selectionButton.classList.toggle('active', settings.selectionTranslation);
  selectionButton.title = `划词翻译跟随当前网页服务：${currentProviderName()}`;
  floatingButton.classList.toggle('active', settings.floatingBall);
  displayModeButton.textContent = settings.displayMode === 'bilingual' ? '双语' : '译文';
  displayModeButton.title = settings.displayMode === 'bilingual' ? '当前：双语对照' : '当前：仅显示译文';
}

async function toggleSetting(key: 'hoverTranslation' | 'selectionTranslation' | 'floatingBall'): Promise<void> {
  settings = { ...settings, [key]: !settings[key] };
  await persistSettings();
  const labels = { hoverTranslation: '鼠标悬停翻译', selectionTranslation: '划词翻译', floatingBall: '悬浮按钮' };
  setStatus(`${labels[key]}已${settings[key] ? '开启' : '关闭'}`, 'success');
}

async function initialize(): Promise<void> {
  addLanguageOptions(sourceSelect, true);
  addLanguageOptions(targetSelect, false);
  settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' } satisfies RuntimeMessage) as Settings;
  populateProviders(settings);
  sourceSelect.value = settings.sourceLanguage;
  targetSelect.value = settings.targetLanguage;
  shortcutLabels = await loadShortcutLabels();
  renderFeatureStates();
  renderShortcutLabels();
  try {
    await activeTabId();
    applyPageStatus(await requestPageStatus({ type: 'GET_ACTIVE_PAGE_STATUS' }));
  } catch (error) { setStatus(errorMessage(error), 'error'); }
}

translateButton.addEventListener('click', async () => {
  translateButton.disabled = true;
  try {
    await saveQuickSettings();
    setStatus(pageStatus.translated ? '正在恢复原文…' : '正在分析网页并翻译…');
    applyPageStatus(await requestPageStatus({ type: 'TOGGLE_ACTIVE_PAGE' }));
  } catch (error) { setStatus(errorMessage(error), 'error'); }
  finally { translateButton.disabled = pageStatus.translating; }
});

displayModeButton.addEventListener('click', async () => {
  settings = { ...settings, displayMode: settings.displayMode === 'bilingual' ? 'translation-only' : 'bilingual' };
  await persistSettings();
  if (pageStatus.translated) {
    setStatus(settings.displayMode === 'translation-only' ? '已切换为仅显示译文' : '已切换为双语对照', 'success');
  }
});
hoverButton.addEventListener('click', () => void toggleSetting('hoverTranslation'));
selectionButton.addEventListener('click', () => void toggleSetting('selectionTranslation'));
floatingButton.addEventListener('click', () => void toggleSetting('floatingBall'));
inputButton.addEventListener('click', async () => {
  try {
    await saveQuickSettings();
    const result = await sendToPage<{ ok: boolean; message: string }>({ type: 'TRANSLATE_INPUT' });
    setStatus(result.message, result.ok ? 'success' : 'error');
  } catch (error) { setStatus(errorMessage(error), 'error'); }
});
textButton.addEventListener('click', () => void browser.tabs.create({ url: browser.runtime.getURL('/text-translate.html') }));
documentButton.addEventListener('click', () => void browser.tabs.create({ url: browser.runtime.getURL('/document-translate.html') }));
swapLanguagesButton.addEventListener('click', () => {
  if (sourceSelect.value === 'auto') { sourceSelect.value = targetSelect.value; targetSelect.value = 'en'; }
  else { const previous = sourceSelect.value; sourceSelect.value = targetSelect.value; targetSelect.value = previous; }
  void saveQuickSettings().then(() => setStatus('源语言和目标语言已交换', 'success'));
});
optionsButton.addEventListener('click', () => void browser.runtime.openOptionsPage());
moreButton.addEventListener('click', () => void browser.tabs.create({ url: browser.runtime.getURL('/privacy.html') }));
providerSelect.addEventListener('change', () => void saveQuickSettings().then(() => setStatus('翻译服务已切换', 'success')));
sourceSelect.addEventListener('change', () => void saveQuickSettings());
targetSelect.addEventListener('change', () => void saveQuickSettings());


browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === 'PAGE_STATUS_CHANGED' && message.tabId === currentTabId) {
    applyPageStatus(message.status);
  }
  return undefined;
});

void initialize().catch((error) => setStatus(errorMessage(error), 'error'));
