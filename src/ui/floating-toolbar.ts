import { browser } from 'wxt/browser';
import { errorMessage } from '../shared/errors';
import { normalizeFloatingBallTransparency } from '../shared/constants';
import type { RuntimeMessage, Settings } from '../shared/types';
import styles from './floating-toolbar.css?inline';
import { AIT_MONOGRAM } from './monogram';

const icon = (paths: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const translateIcon = icon('<path d="M3 5h12M9 3v2M5 5c1 6 5 9 9 10M12 5c-1 6-5 9-9 10M14 21l4-10 4 10M16 17h4"/>');
const dualIcon = icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>');
const singleIcon = icon('<rect x="3" y="4" width="18" height="16" rx="2"/>');
const summaryIcon = icon('<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4"/>');

export class FloatingToolbar {
  private readonly host = document.createElement('div');
  private readonly root = this.host.attachShadow({ mode: 'open' });
  private readonly events = new AbortController();
  private open = false;
  private running = false;
  private translating = false;
  private translated = false;
  private mode: Settings['displayMode'];

  constructor(settings: Settings, private readonly translate: () => Promise<unknown>, private readonly summarize: () => Promise<unknown>) {
    this.mode = settings.displayMode;
    this.host.id = 'aitran-floating-toolbar';
    this.host.dataset.aitranUi = 'true';
    this.host.style.cssText = 'all:initial!important;position:fixed!important;right:12px!important;top:clamp(8px,55%,calc(100vh - 64px))!important;z-index:2147483645!important;display:block!important;';
    this.root.innerHTML = `<style>${styles}</style><div class="dock">
      <div class="tools" id="floating-actions" role="group" aria-label="网页快捷操作" hidden>
        <button class="action translate" type="button">${translateIcon}</button>
        <button class="action mode" type="button"></button>
        <button class="action summary" type="button" aria-label="AI 页面总结" data-tooltip="AI 页面总结">${summaryIcon}</button>
      </div>
      <button class="ball" type="button" aria-controls="floating-actions" aria-expanded="false">${AIT_MONOGRAM}</button>
      <p class="error" role="alert" hidden></p>
    </div>`;
    document.documentElement.append(this.host);
    this.get('.ball').addEventListener('click', () => { this.open = !this.open; this.get('.error').hidden = true; this.render(); });
    this.get('.translate').addEventListener('click', () => void this.run(this.translate));
    this.get('.summary').addEventListener('click', () => void this.run(this.summarize));
    this.get('.mode').addEventListener('click', () => void this.run(async () => {
      const next = this.mode === 'bilingual' ? 'translation-only' : 'bilingual';
      const saved = await browser.runtime.sendMessage({ type: 'SET_DISPLAY_MODE', displayMode: next } satisfies RuntimeMessage) as Settings;
      this.mode = saved.displayMode;
    }, false));
    document.addEventListener('pointerdown', (event) => {
      if (!event.composedPath().includes(this.host)) { this.open = false; this.render(); }
    }, { capture: true, signal: this.events.signal });
    this.root.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') { event.stopPropagation(); this.open = false; this.render(); this.get('.ball').focus(); }
    });
    this.applySettings(settings);
  }

  private get<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }
  applySettings(settings: Settings): void {
    this.mode = settings.displayMode;
    this.get('.ball').style.setProperty('--ball-alpha', String(1 - normalizeFloatingBallTransparency(settings.floatingBallTransparency) / 100));
    this.render();
  }
  setPageState(translated: boolean, translating = false): void { this.translated = translated; this.translating = translating; this.render(); }
  dispose(): void { this.events.abort(); this.host.remove(); }

  private async run(action: () => Promise<unknown>, close = true): Promise<void> {
    if (this.running) return;
    this.running = true;
    if (close) { this.open = false; this.get('.ball').focus(); }
    this.get('.error').hidden = true;
    this.render();
    try {
      const result = await action() as { ok?: boolean; error?: string } | undefined;
      if (result?.ok === false || result?.error) throw new Error(result.error || '操作失败，请重试。');
    } catch (error) {
      this.get('.error').textContent = errorMessage(error);
      this.get('.error').hidden = false;
    } finally { this.running = false; this.render(); }
  }

  private render(): void {
    this.get('.tools').hidden = !this.open;
    const ball = this.get<HTMLButtonElement>('.ball');
    ball.setAttribute('aria-expanded', String(this.open));
    ball.setAttribute('aria-label', `AiT，${this.open ? '收起' : '展开'}快捷操作`);
    ball.dataset.tooltip = this.open ? '收起快捷操作' : '展开快捷操作';
    const translate = this.get<HTMLButtonElement>('.translate');
    const label = this.translating ? '正在翻译…' : this.translated ? '显示原文' : '翻译网页';
    translate.setAttribute('aria-label', label); translate.dataset.tooltip = label;
    translate.dataset.active = String(this.translated);
    translate.disabled = this.running || this.translating;
    const mode = this.get<HTMLButtonElement>('.mode');
    const modeLabel = this.mode === 'bilingual' ? '当前双语，切换为仅译文' : '当前仅译文，切换为双语';
    mode.setAttribute('aria-label', modeLabel); mode.dataset.tooltip = modeLabel;
    mode.dataset.active = String(this.mode === 'bilingual');
    // Keep the button itself alive so keyboard focus is retained during updates.
    mode.innerHTML = this.mode === 'bilingual' ? dualIcon : singleIcon;
    mode.disabled = this.running;
    this.get<HTMLButtonElement>('.summary').disabled = this.running;
  }
}
