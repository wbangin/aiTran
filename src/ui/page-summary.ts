import { browser } from 'wxt/browser';
import { collectPageContent, type PageContent } from '../core/page-content';
import { LANGUAGES } from '../shared/constants';
import { errorMessage } from '../shared/errors';
import { summaryProviders } from '../shared/summary';
import type { PageSummaryResponse, RuntimeMessage, Settings } from '../shared/types';
import styles from './page-summary.css?inline';
import brandLogo from '../../public/icons/ait.svg?raw';

function createOption(label: string, value: string): HTMLOptionElement {
  const option = document.createElement('option');
  option.textContent = label;
  option.value = value;
  return option;
}

export function renderSummary(container: HTMLElement, summary: string): void {
  container.replaceChildren();
  let list: HTMLUListElement | undefined;
  for (const line of summary.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) { list = undefined; continue; }
    const heading = text.match(/^#{1,6}\s+(.+)$/);
    const bullet = text.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    let element: HTMLElement;
    if (heading) {
      element = document.createElement('h3');
      element.textContent = heading[1]!;
      list = undefined;
    } else if (bullet) {
      if (!list) { list = document.createElement('ul'); container.append(list); }
      element = document.createElement('li');
      element.textContent = bullet[1]!;
      list.append(element);
    } else {
      element = document.createElement('p');
      element.textContent = text;
      list = undefined;
    }
    // Support emphasis without ever interpreting model output as HTML.
    const parts = (element.textContent ?? '').split(/(\*\*[^*]+\*\*)/g);
    element.replaceChildren(...parts.map((part) => {
      if (!part.startsWith('**') || !part.endsWith('**')) return document.createTextNode(part);
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      return strong;
    }));
    if (!bullet) container.append(element);
  }
  // Highlight the actual opening section without inventing headings or parsing HTML.
  const first = container.firstElementChild;
  if (first?.tagName === 'H3' || first?.tagName === 'P') {
    const lead = document.createElement('section');
    lead.className = 'summary-lead';
    container.prepend(lead);
    lead.append(first);
    if (first.tagName === 'H3') {
      while (lead.nextElementSibling && lead.nextElementSibling.tagName !== 'H3') lead.append(lead.nextElementSibling);
    }
  }
}

export class PageSummaryPanel {
  private host?: HTMLDivElement;
  private root?: ShadowRoot;
  private content?: PageContent;
  private summary = '';
  private busy = false;
  private settingsReady = false;
  private settingsLoaded = false;
  private previousFocus?: HTMLElement;
  private configurationExpanded = false;

  open(): void {
    if (!this.host) this.createPanel();
    if (document.activeElement instanceof HTMLElement && document.activeElement !== this.host) this.previousFocus = document.activeElement;
    this.host!.hidden = false;
    this.host!.style.setProperty('display', 'block', 'important');
    this.get<HTMLButtonElement>('.close').focus();
    if (!this.busy) {
      const next = collectPageContent();
      if (this.content?.text !== next.text || this.content?.title !== next.title) this.resetResult();
      this.content = next;
      const notice = this.get('.notice');
      notice.hidden = !next.truncated;
      notice.textContent = '正文较长，本次仅总结前 24,000 个字符，后续内容未包含。';
      void this.loadSettings();
    }
  }

  private get<T extends HTMLElement = HTMLElement>(selector: string): T {
    return this.root!.querySelector<T>(selector)!;
  }

  private createPanel(): void {
    const host = document.createElement('div');
    host.dataset.aitranUi = 'true';
    host.id = 'aitran-page-summary';
    host.style.cssText = 'all: initial !important; position: fixed !important; top: 20px !important; right: 12px !important; z-index: 2147483647 !important; display: block !important;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${styles}</style>
      <section class="panel" role="region" aria-label="AI 页面总结">
        <header><span class="mark" aria-hidden="true">${brandLogo}</span><h2>AI 页面总结</h2><button class="close" title="关闭总结" aria-label="关闭总结">×</button></header>
        <div class="scroll">
          <div class="result-meta" hidden><span class="result-context"></span><button class="adjust" aria-expanded="false" aria-controls="summary-configuration">调整配置</button></div>
          <div class="configuration" id="summary-configuration">
          <div class="controls"><label>AI 服务<select class="provider" aria-label="AI 服务"></select></label><label>总结语言<select class="language" aria-label="总结语言"></select></label></div>
          <div class="actions"><button class="generate" disabled>生成总结</button></div>
          </div>
          <p class="notice" hidden></p><p class="status" role="status" aria-live="polite"></p>
          <div class="loading" hidden><span class="spinner" aria-hidden="true"></span>正在阅读页面并整理要点…</div>
          <div class="result" aria-label="总结结果"></div>
          <div class="result-actions" hidden><span>重要信息请结合原文核实</span><button class="regenerate">重新总结</button><button class="copy" disabled hidden>复制</button></div>
        </div>
        <footer><span>仅在生成时发送正文至所选 API</span><button class="settings">配置 AI 服务 ↗</button></footer>
      </section>`;
    document.documentElement.append(host);
    this.host = host;
    this.root = root;
    for (const [value, label] of LANGUAGES) if (value !== 'auto') this.get<HTMLSelectElement>('.language').add(createOption(label, value));
    const close = () => {
      // The page may override the native [hidden] rule, so hide the fixed host explicitly.
      host.style.setProperty('display', 'none', 'important');
      if (this.previousFocus?.isConnected) this.previousFocus.focus();
    };
    this.get('.close').addEventListener('click', close);
    root.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') { event.stopPropagation(); close(); }
    });
    this.get('.settings').addEventListener('click', () => {
      void browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' } satisfies RuntimeMessage).catch((error) => this.setStatus(errorMessage(error), true));
    });
    this.get('.generate').addEventListener('click', () => void this.generate());
    this.get('.regenerate').addEventListener('click', () => void this.generate());
    this.get('.adjust').addEventListener('click', () => {
      this.configurationExpanded = !this.configurationExpanded;
      this.renderLayout();
    });
    for (const selector of ['.provider', '.language']) this.get(selector).addEventListener('change', () => {
      this.resetResult();
      this.setStatus('');
    });
    this.get('.copy').addEventListener('click', () => {
      void navigator.clipboard.writeText(this.summary).then(() => {
        this.get('.copy').textContent = '已复制';
      }).catch(() => this.setStatus('复制失败，请选中总结内容手动复制。', true));
    });
  }

  private setStatus(text: string, error = false): void {
    const status = this.get('.status');
    status.textContent = text;
    status.classList.toggle('error', error);
  }

  private resetResult(): void {
    this.summary = '';
    this.configurationExpanded = false;
    this.get('.result').replaceChildren();
    this.get<HTMLButtonElement>('.copy').disabled = true;
    this.get('.copy').hidden = true;
    this.get('.copy').textContent = '复制';
    this.get('.generate').textContent = '生成总结';
    this.renderLayout();
  }

  private renderLayout(): void {
    const ready = Boolean(this.summary);
    this.get('.result-meta').hidden = !ready;
    this.get('.configuration').hidden = ready && !this.configurationExpanded;
    this.get('.actions').hidden = ready;
    this.get('.result-actions').hidden = !ready;
    this.get('.adjust').textContent = this.configurationExpanded ? '收起配置' : '调整配置';
    this.get('.adjust').setAttribute('aria-expanded', String(this.configurationExpanded));
  }

  private async loadSettings(): Promise<void> {
    this.settingsReady = false;
    this.get<HTMLButtonElement>('.generate').disabled = true;
    this.get<HTMLButtonElement>('.regenerate').disabled = true;
    try {
      const settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' } satisfies RuntimeMessage) as Settings;
      const providers = summaryProviders(settings);
      const select = this.get<HTMLSelectElement>('.provider');
      const previous = select.value;
      select.replaceChildren(...providers.map((provider) => createOption(provider.name, `custom:${provider.id}`)));
      const selected = providers.find((provider) => `custom:${provider.id}` === previous)
        ?? providers.find((provider) => `custom:${provider.id}` === settings.providerId) ?? providers[0];
      if (selected) select.value = `custom:${selected.id}`;
      else select.add(createOption('尚未配置 AI 服务', ''));
      if (this.summary && select.value !== previous) this.resetResult();
      if (!this.settingsLoaded) this.get<HTMLSelectElement>('.language').value = settings.targetLanguage;
      this.settingsLoaded = true;
      this.settingsReady = Boolean(selected);
      this.get<HTMLButtonElement>('.generate').disabled = !selected || !this.content?.text.trim();
      this.get<HTMLButtonElement>('.regenerate').disabled = !selected || !this.content?.text.trim();
      if (!selected) this.setStatus('点击右下角「配置 AI 服务」，添加 OpenAI 兼容自定义 API 并填写模型，即可开始总结。');
      else if (!this.content?.text.trim()) this.setStatus('没有找到可读取的正文。请等待页面加载完成后重新打开；浏览器内置 PDF 和跨域嵌入内容暂不支持。', true);
      else if (!this.summary) this.setStatus('');
      this.renderLayout();
    } catch (error) {
      this.setStatus(errorMessage(error), true);
    }
  }

  private async generate(): Promise<void> {
    if (this.busy || !this.settingsReady) return;
    // Read again at click time so SPA navigation and newly loaded content are included.
    this.content = collectPageContent();
    if (!this.content.text.trim()) { this.setStatus('没有找到可总结的正文。', true); return; }
    this.get('.notice').hidden = !this.content.truncated;
    const language = this.get<HTMLSelectElement>('.language');
    const languageValue = language.value;
    const languageLabel = language.selectedOptions[0]?.textContent ?? languageValue;
    const providerId = this.get<HTMLSelectElement>('.provider').value as Settings['providerId'];
    this.resetResult();
    this.busy = true;
    this.get<HTMLButtonElement>('.generate').disabled = true;
    this.get('.generate').textContent = '正在总结…';
    this.get<HTMLSelectElement>('.provider').disabled = true;
    this.get<HTMLSelectElement>('.language').disabled = true;
    this.get('.loading').hidden = false;
    this.setStatus('');
    try {
      const response = await browser.runtime.sendMessage({
        type: 'SUMMARIZE_PAGE',
        request: {
          title: this.content.title,
          text: this.content.text,
          targetLanguage: languageValue,
          providerId
        }
      } satisfies RuntimeMessage) as PageSummaryResponse;
      if (!response?.ok) throw new Error(response?.error || 'AI 服务未返回总结，请重试。');
      this.summary = response.summary;
      renderSummary(this.get('.result'), response.summary);
      this.get<HTMLButtonElement>('.copy').disabled = false;
      this.get('.copy').hidden = false;
      this.get('.result-context').textContent = `${response.providerName} · ${languageLabel}`;
      this.setStatus('');
      this.get('.generate').textContent = '重新总结';
      this.renderLayout();
    } catch (error) {
      this.setStatus(errorMessage(error), true);
      this.get('.generate').textContent = '重试总结';
    } finally {
      this.busy = false;
      this.get<HTMLButtonElement>('.generate').disabled = false;
      this.get<HTMLSelectElement>('.provider').disabled = false;
      this.get<HTMLSelectElement>('.language').disabled = false;
      this.get('.loading').hidden = true;
    }
  }
}
