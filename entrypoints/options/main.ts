import { browser } from 'wxt/browser';
import './style.css';
import { LANGUAGES } from '../../src/shared/constants';
import { errorMessage } from '../../src/shared/errors';
import { loadShortcutLabels } from '../../src/shared/shortcuts';
import { createId } from '../../src/shared/id';
import { DEFAULT_PROMPT_CONFIG, normalizeCustomProviderConfig } from '../../src/shared/prompts';
import type { CustomProviderConfig, RuntimeMessage, Settings } from '../../src/shared/types';

const providerSelect = document.querySelector<HTMLSelectElement>('#default-provider')!;
const sourceSelect = document.querySelector<HTMLSelectElement>('#source-language')!;
const targetSelect = document.querySelector<HTMLSelectElement>('#target-language')!;
const displayModeSelect = document.querySelector<HTMLSelectElement>('#display-mode')!;
const hoverShortcutHelp = document.querySelector<HTMLElement>('#hover-shortcut-help')!;
const inputShortcutHelp = document.querySelector<HTMLElement>('#input-shortcut-help')!;
const autoTranslateInput = document.querySelector<HTMLInputElement>('#auto-translate')!;
const autoFallbackInput = document.querySelector<HTMLInputElement>('#auto-fallback')!;
const selectionTranslationInput = document.querySelector<HTMLInputElement>('#selection-translation')!;
const hoverTranslationInput = document.querySelector<HTMLInputElement>('#hover-translation')!;
const inputTranslationInput = document.querySelector<HTMLInputElement>('#input-translation')!;
const floatingBallInput = document.querySelector<HTMLInputElement>('#floating-ball')!;
const customList = document.querySelector<HTMLDivElement>('#custom-providers')!;
const template = document.querySelector<HTMLTemplateElement>('#provider-template')!;
const addButton = document.querySelector<HTMLButtonElement>('#add-provider')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save')!;
const messageElement = document.querySelector<HTMLDivElement>('#message')!;
let settings: Settings;

function setMessage(message: string, type: 'normal' | 'ok' | 'error' = 'normal'): void {
  messageElement.textContent = message;
  messageElement.className = type === 'normal' ? '' : type;
}

function fillLanguages(select: HTMLSelectElement, includeAuto: boolean): void {
  LANGUAGES.forEach(([value, label]) => {
    if (includeAuto || value !== 'auto') select.add(new Option(label, value));
  });
}

function field<T extends Element>(container: HTMLElement, name: string): T {
  return container.querySelector<T>(`[data-field="${name}"]`)!;
}

function readProvider(element: HTMLElement): CustomProviderConfig {
  return normalizeCustomProviderConfig({
    id: element.dataset.providerId ?? createId('custom'),
    name: field<HTMLInputElement>(element, 'name').value.trim(),
    url: field<HTMLInputElement>(element, 'url').value.trim(),
    apiKey: field<HTMLInputElement>(element, 'apiKey').value,
    enabled: field<HTMLInputElement>(element, 'enabled').checked,
    protocol: field<HTMLSelectElement>(element, 'protocol').value as CustomProviderConfig['protocol'],
    model: field<HTMLInputElement>(element, 'model').value.trim(),
    temperature: Number(field<HTMLInputElement>(element, 'temperature').value),
    maxBatchSize: Number(field<HTMLInputElement>(element, 'maxBatchSize').value),
    batchMode: field<HTMLSelectElement>(element, 'batchMode').value as CustomProviderConfig['batchMode'],
    systemPrompt: field<HTMLTextAreaElement>(element, 'systemPrompt').value,
    singlePrompt: field<HTMLTextAreaElement>(element, 'singlePrompt').value,
    subtitlePrompt: field<HTMLTextAreaElement>(element, 'subtitlePrompt').value,
    multiPrompt: field<HTMLTextAreaElement>(element, 'multiPrompt').value
  });
}

function currentCustomProviders(): CustomProviderConfig[] {
  return Array.from(customList.querySelectorAll<HTMLElement>('.custom-provider')).map(readProvider);
}

function refreshProviderOptions(selected = providerSelect.value): void {
  providerSelect.replaceChildren();
  const freeGroup = document.createElement('optgroup');
  freeGroup.label = '免费组';
  freeGroup.append(new Option('Microsoft Translate', 'microsoft'), new Option('Google Translate', 'google'));
  providerSelect.append(freeGroup);

  const customProviders = currentCustomProviders().filter((provider) => provider.enabled && provider.name && provider.url);
  if (customProviders.length) {
    const group = document.createElement('optgroup');
    group.label = '自定义组';
    customProviders.forEach((provider) => group.append(new Option(provider.name, `custom:${provider.id}`)));
    providerSelect.append(group);
  }
  providerSelect.value = Array.from(providerSelect.options).some((option) => option.value === selected) ? selected : 'microsoft';
}

function updateEmptyState(): void {
  customList.querySelector('.empty')?.remove();
  if (!customList.querySelector('.custom-provider')) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '还没有自定义服务，点击“添加服务”开始配置。';
    customList.append(empty);
  }
}

function renderProvider(provider: CustomProviderConfig): void {
  customList.querySelector('.empty')?.remove();
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const element = fragment.querySelector<HTMLElement>('.custom-provider')!;
  element.dataset.providerId = provider.id;
  field<HTMLInputElement>(element, 'name').value = provider.name;
  field<HTMLInputElement>(element, 'url').value = provider.url;
  const normalized = normalizeCustomProviderConfig(provider);
  field<HTMLInputElement>(element, 'apiKey').value = normalized.apiKey;
  field<HTMLInputElement>(element, 'enabled').checked = normalized.enabled;
  field<HTMLSelectElement>(element, 'protocol').value = normalized.protocol;
  field<HTMLInputElement>(element, 'model').value = normalized.model;
  field<HTMLInputElement>(element, 'temperature').value = String(normalized.temperature);
  field<HTMLInputElement>(element, 'maxBatchSize').value = String(normalized.maxBatchSize);
  field<HTMLSelectElement>(element, 'batchMode').value = normalized.batchMode;
  field<HTMLTextAreaElement>(element, 'systemPrompt').value = normalized.systemPrompt;
  field<HTMLTextAreaElement>(element, 'singlePrompt').value = normalized.singlePrompt;
  field<HTMLTextAreaElement>(element, 'subtitlePrompt').value = normalized.subtitlePrompt;
  field<HTMLTextAreaElement>(element, 'multiPrompt').value = normalized.multiPrompt;
  const openAiSection = element.querySelector<HTMLElement>('[data-section="openai"]')!;
  const updateProtocolView = () => openAiSection.classList.toggle('visible', field<HTMLSelectElement>(element, 'protocol').value === 'openai-compatible');
  field<HTMLSelectElement>(element, 'protocol').addEventListener('change', updateProtocolView);
  updateProtocolView();

  element.querySelector<HTMLButtonElement>('[data-action="remove"]')!.addEventListener('click', () => {
    element.remove();
    refreshProviderOptions();
    updateEmptyState();
  });
  element.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    input.addEventListener('input', () => refreshProviderOptions(providerSelect.value));
  });
  element.querySelector<HTMLButtonElement>('[data-action="resetPrompts"]')!.addEventListener('click', () => {
    field<HTMLTextAreaElement>(element, 'systemPrompt').value = DEFAULT_PROMPT_CONFIG.systemPrompt;
    field<HTMLTextAreaElement>(element, 'singlePrompt').value = DEFAULT_PROMPT_CONFIG.singlePrompt;
    field<HTMLTextAreaElement>(element, 'subtitlePrompt').value = DEFAULT_PROMPT_CONFIG.subtitlePrompt;
    field<HTMLTextAreaElement>(element, 'multiPrompt').value = DEFAULT_PROMPT_CONFIG.multiPrompt;
  });
  element.querySelector<HTMLButtonElement>('[data-action="test"]')!.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const resultElement = field<HTMLSpanElement>(element, 'testResult');
    const current = readProvider(element);
    button.disabled = true;
    resultElement.textContent = '测试中…';
    resultElement.className = '';
    try {
      const result = await browser.runtime.sendMessage({
        type: 'TEST_CUSTOM_PROVIDER',
        provider: current
      } satisfies RuntimeMessage) as { ok: boolean; translation?: string; error?: string };
      resultElement.textContent = result.ok ? `连接成功：${result.translation ?? ''}` : `连接失败：${result.error ?? ''}`;
      resultElement.className = result.ok ? 'ok' : 'error';
    } catch (error) {
      resultElement.textContent = `连接失败：${errorMessage(error)}`;
      resultElement.className = 'error';
    } finally {
      button.disabled = false;
    }
  });

  customList.append(fragment);
}

function collectSettings(): Settings {
  const customProviders = currentCustomProviders();
  for (const provider of customProviders) {
    if (!provider.name) throw new Error('请填写自定义服务名称');
    if (!provider.url) throw new Error(`请填写“${provider.name}”的请求 URL`);
    const url = new URL(provider.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`“${provider.name}”只支持 HTTP 或 HTTPS URL`);
    if (provider.protocol === 'openai-compatible' && !provider.model) throw new Error(`请填写“${provider.name}”的模型名称`);
  }
  return {
    providerId: providerSelect.value as Settings['providerId'],
    sourceLanguage: sourceSelect.value,
    targetLanguage: targetSelect.value,
    displayMode: displayModeSelect.value as Settings['displayMode'],
    autoTranslate: autoTranslateInput.checked,
    autoFallback: autoFallbackInput.checked,
    selectionTranslation: selectionTranslationInput.checked,
    hoverTranslation: hoverTranslationInput.checked,
    inputTranslation: inputTranslationInput.checked,
    floatingBall: floatingBallInput.checked,
    customProviders
  };
}

async function initialize(): Promise<void> {
  const shortcuts = await loadShortcutLabels();
  hoverShortcutHelp.textContent = `按住 ${shortcuts.hoverModifier} 并悬停 650ms 后翻译段落`;
  inputShortcutHelp.textContent = `聚焦输入框后按 ${shortcuts.translateInput}`;
  fillLanguages(sourceSelect, true);
  fillLanguages(targetSelect, false);
  settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' } satisfies RuntimeMessage) as Settings;
  settings.customProviders.forEach(renderProvider);
  updateEmptyState();
  refreshProviderOptions(settings.providerId);
  sourceSelect.value = settings.sourceLanguage;
  targetSelect.value = settings.targetLanguage;
  displayModeSelect.value = settings.displayMode;
  autoTranslateInput.checked = settings.autoTranslate;
  autoFallbackInput.checked = settings.autoFallback;
  selectionTranslationInput.checked = settings.selectionTranslation;
  hoverTranslationInput.checked = settings.hoverTranslation;
  inputTranslationInput.checked = settings.inputTranslation;
  floatingBallInput.checked = settings.floatingBall;
}

addButton.addEventListener('click', () => {
  renderProvider(normalizeCustomProviderConfig({ id: createId('custom'), name: '', url: '', apiKey: '', enabled: true }));
  refreshProviderOptions();
});

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  try {
    settings = collectSettings();
    settings = await browser.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings } satisfies RuntimeMessage) as Settings;
    refreshProviderOptions(settings.providerId);
    const tabs = await browser.tabs.query({});
    await Promise.all(tabs.filter((tab) => tab.id !== undefined).map((tab) => browser.tabs.sendMessage(tab.id!, { type: 'REFRESH_SETTINGS' } satisfies RuntimeMessage).catch(() => undefined)));
    setMessage('设置已保存，已同步到打开的网页', 'ok');
  } catch (error) {
    setMessage(errorMessage(error), 'error');
  } finally {
    saveButton.disabled = false;
  }
});

void initialize().catch((error) => setMessage(errorMessage(error), 'error'));
