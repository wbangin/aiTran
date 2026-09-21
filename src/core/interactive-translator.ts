import { browser } from 'wxt/browser';
import { normalizeText } from './dom';
import { errorMessage } from '../shared/errors';
import { providerIdForInteractiveScene } from '../shared/provider-routing';
import type { RuntimeMessage, Settings, TranslateResult } from '../shared/types';

const UI_ATTRIBUTE = 'data-aitran-ui';
const INTERACTIVE_STYLE_ID = 'aitran-interactive-styles';

function installInteractiveStyles(): void {
  if (document.getElementById(INTERACTIVE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = INTERACTIVE_STYLE_ID;
  style.setAttribute(UI_ATTRIBUTE, 'true');
  style.textContent = `
    .aitran-selection-trigger, .aitran-float-ball {
      position: fixed !important; z-index: 2147483645 !important; display: grid !important; place-items: center !important;
      border: 0 !important; color: #fff !important; background: linear-gradient(135deg,#4f46e5,#2563eb) !important;
      box-shadow: 0 7px 20px rgba(37,70,180,.24) !important; cursor: pointer !important;
      font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
    }
    .aitran-selection-trigger { width: 30px !important; height: 30px !important; border-radius: 9px !important; font-size: 12px !important; }
    .aitran-float-ball {
      right: 0 !important; top: 55% !important; width: 30px !important; height: 32px !important;
      border: 1px solid rgba(255,255,255,.58) !important; border-right: 0 !important;
      border-radius: 10px 0 0 10px !important; font-size: 11px !important; font-weight: 750 !important;
      background: linear-gradient(135deg,rgba(79,70,229,.58),rgba(37,99,235,.58)) !important;
      box-shadow: 0 4px 13px rgba(37,70,180,.14) !important; backdrop-filter: blur(7px) !important;
      opacity: .62 !important; transition: width .18s ease, transform .18s ease, opacity .18s ease, background .18s ease !important;
    }
    .aitran-float-ball:hover {
      width: 34px !important; transform: none !important; opacity: .94 !important;
      background: linear-gradient(135deg,rgba(79,70,229,.86),rgba(37,99,235,.86)) !important;
    }
    .aitran-float-ball[data-translated="true"] {
      background: linear-gradient(135deg,rgba(51,65,85,.58),rgba(67,56,202,.58)) !important;
    }
    .aitran-float-ball[data-translated="true"]:hover {
      background: linear-gradient(135deg,rgba(51,65,85,.88),rgba(67,56,202,.88)) !important;
    }
    .aitran-popover {
      position: fixed !important; z-index: 2147483646 !important; width: min(350px,calc(100vw - 24px)) !important;
      max-height: min(460px,calc(100vh - 24px)) !important; overflow: auto !important; padding: 13px !important;
      border: 1px solid rgba(120,120,150,.2) !important; border-radius: 12px !important;
      color: #202435 !important; background: rgba(255,255,255,.97) !important; backdrop-filter: blur(16px) !important;
      box-shadow: 0 18px 55px rgba(25,30,60,.23) !important; font: 13px/1.58 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
    }
    .aitran-popover-head { display:flex !important; align-items:center !important; justify-content:space-between !important; gap:10px !important; margin-bottom:10px !important; }
    .aitran-popover-title { font-weight:750 !important; color:#4338ca !important; }
    .aitran-popover-close, .aitran-popover-copy { border:0 !important; border-radius:8px !important; cursor:pointer !important; font:inherit !important; }
    .aitran-popover-close { width:27px !important; height:27px !important; color:#73788a !important; background:#f0f1f6 !important; }
    .aitran-popover-copy { margin-top:11px !important; padding:6px 11px !important; color:#4338ca !important; background:#eef0ff !important; }
    .aitran-popover-original { margin-bottom:9px !important; padding-bottom:9px !important; border-bottom:1px solid #eceef4 !important; color:#7b8090 !important; font-size:12px !important; }
    .aitran-popover-result { color:#24283a !important; white-space:pre-wrap !important; }
    .aitran-popover-loading { color:#777e91 !important; }
    @media (prefers-color-scheme:dark) {
      .aitran-popover { color:#eef0f6 !important; background:rgba(30,33,44,.97) !important; border-color:#3b4051 !important; }
      .aitran-popover-result { color:#eef0f6 !important; } .aitran-popover-original { color:#a6adbd !important; border-color:#404556 !important; }
      .aitran-popover-close { color:#c8ccda !important; background:#3b4050 !important; }
    }
  `;
  document.documentElement.append(style);
}

function safePosition(x: number, y: number, width = 380, height = 260): { left: number; top: number } {
  return {
    left: Math.max(12, Math.min(x, window.innerWidth - width - 12)),
    top: Math.max(12, Math.min(y, window.innerHeight - height - 12))
  };
}

function isUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`[${UI_ATTRIBUTE}]`));
}

function eligibleHoverElement(target: EventTarget | null): HTMLElement | undefined {
  if (!(target instanceof HTMLElement) || isUiTarget(target)) return undefined;
  if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'CODE', 'PRE', 'SCRIPT', 'STYLE'].includes(target.tagName)) return undefined;
  const element = target.closest<HTMLElement>('p,li,blockquote,h1,h2,h3,h4,h5,h6,td,th,figcaption,article');
  if (!element) return undefined;
  const text = normalizeText(element.innerText);
  return text.length >= 2 && text.length <= 1200 ? element : undefined;
}

export class InteractiveTranslator {
  private selectionTrigger?: HTMLButtonElement;
  private popover?: HTMLDivElement;
  private floatBall?: HTMLButtonElement;
  private selectedText = '';
  private hoverTimer?: number;
  private altPressed = false;
  private lastHoverElement?: HTMLElement;
  private translatedPage = false;
  private lastEditable?: HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  private readonly isTopFrame = (() => { try { return window.self === window.top; } catch { return false; } })();

  constructor(
    private settings: Settings,
    private readonly togglePage: () => Promise<unknown>
  ) {
    installInteractiveStyles();
    this.bindEvents();
    this.applySettings(settings);
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    if (!settings.selectionTranslation) this.removeSelectionTrigger();
    if (!settings.floatingBall || !this.isTopFrame) this.floatBall?.remove();
    else this.ensureFloatBall();
  }

  setPageTranslated(translated: boolean): void {
    this.translatedPage = translated;
    if (this.floatBall) {
      this.floatBall.dataset.translated = String(translated);
      this.floatBall.textContent = translated ? '原' : '译';
      this.floatBall.title = translated ? '恢复原文' : '翻译当前网页';
    }
  }

  async translateInput(): Promise<{ ok: boolean; message: string }> {
    if (!this.settings.inputTranslation) return { ok: false, message: '输入框翻译未启用' };
    const focused = document.activeElement;
    const active = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement || (focused instanceof HTMLElement && focused.isContentEditable)
      ? focused
      : this.lastEditable;
    let text = '';
    if (active instanceof HTMLInputElement) {
      if (active.type === 'password') return { ok: false, message: '不会翻译密码输入框' };
      text = active.value;
    } else if (active instanceof HTMLTextAreaElement) {
      text = active.value;
    } else if (active instanceof HTMLElement && active.isContentEditable) {
      text = active.innerText;
    } else {
      return { ok: false, message: '请先聚焦一个输入框' };
    }
    if (!normalizeText(text)) return { ok: false, message: '输入框中没有可翻译内容' };

    try {
      const translation = await this.translateText(text, 'input');
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        const prototype = active instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (setter) setter.call(active, translation);
        else active.value = translation;
        active.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: translation }));
        active.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (active instanceof HTMLElement) {
        active.innerText = translation;
        active.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: translation }));
      }
      return { ok: true, message: '输入框翻译完成' };
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  }

  async showContextSelection(text: string): Promise<void> {
    const normalized = normalizeText(text).slice(0, 1600);
    if (!normalized) return;
    await this.showTranslation(normalized, window.innerWidth / 2 - 190, window.innerHeight / 2 - 100, '划词翻译');
  }

  private bindEvents(): void {
    document.addEventListener('focusin', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) this.lastEditable = target;
    }, true);
    document.addEventListener('mouseup', (event) => this.handleSelection(event), true);
    document.addEventListener('mousedown', (event) => {
      if (!isUiTarget(event.target)) this.removeSelectionTrigger();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Alt') this.altPressed = true;
    }, true);
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Alt') {
        this.altPressed = false;
        window.clearTimeout(this.hoverTimer);
      }
    }, true);
    window.addEventListener('blur', () => { this.altPressed = false; });
    document.addEventListener('mouseover', (event) => this.handleHover(event), true);
  }

  private handleSelection(event: MouseEvent): void {
    if (!this.settings.selectionTranslation || isUiTarget(event.target)) return;
    window.setTimeout(() => {
      const selection = window.getSelection();
      const text = normalizeText(selection?.toString() ?? '');
      if (!selection || selection.isCollapsed || text.length < 2 || text.length > 1600) return;
      const range = selection.rangeCount ? selection.getRangeAt(0) : undefined;
      const rect = range?.getBoundingClientRect();
      if (!rect) return;
      this.selectedText = text;
      this.showSelectionTrigger(rect.right + 6, rect.bottom + 6);
    }, 0);
  }

  private showSelectionTrigger(x: number, y: number): void {
    this.removeSelectionTrigger();
    const position = safePosition(x, y, 40, 40);
    const button = document.createElement('button');
    button.className = 'aitran-selection-trigger';
    button.setAttribute(UI_ATTRIBUTE, 'true');
    button.textContent = '译';
    button.title = '翻译选中文本';
    button.style.left = `${position.left}px`;
    button.style.top = `${position.top}px`;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      const text = this.selectedText;
      this.removeSelectionTrigger();
      void this.showTranslation(text, position.left, position.top + 42, '划词翻译');
    });
    document.documentElement.append(button);
    this.selectionTrigger = button;
  }

  private handleHover(event: MouseEvent): void {
    if (!this.settings.hoverTranslation || !this.altPressed) return;
    const element = eligibleHoverElement(event.target);
    if (!element || element === this.lastHoverElement) return;
    this.lastHoverElement = element;
    window.clearTimeout(this.hoverTimer);
    this.hoverTimer = window.setTimeout(() => {
      if (!this.altPressed || !element.isConnected) return;
      const text = normalizeText(element.innerText);
      const rect = element.getBoundingClientRect();
      void this.showTranslation(text, rect.left, rect.bottom + 8, '鼠标悬停翻译');
    }, 650);
  }

  private ensureFloatBall(): void {
    if (this.floatBall?.isConnected) return;
    const button = document.createElement('button');
    button.className = 'aitran-float-ball';
    button.setAttribute(UI_ATTRIBUTE, 'true');
    button.addEventListener('click', () => void this.togglePage());
    document.documentElement.append(button);
    this.floatBall = button;
    this.setPageTranslated(this.translatedPage);
  }

  private async translateText(text: string, scene: 'selection' | 'hover' | 'input' = 'selection'): Promise<string> {
    const result = await browser.runtime.sendMessage({
      type: 'TRANSLATE_BATCH',
      request: {
        texts: [text],
        sourceLanguage: this.settings.sourceLanguage,
        targetLanguage: this.settings.targetLanguage,
        providerId: providerIdForInteractiveScene(this.settings, scene),
        scene,
        context: { title: document.title }
      }
    } satisfies RuntimeMessage) as TranslateResult;
    return result.translations[0] ?? text;
  }

  private async showTranslation(text: string, x: number, y: number, title: string): Promise<void> {
    this.popover?.remove();
    const position = safePosition(x, y);
    const popover = document.createElement('div');
    popover.className = 'aitran-popover';
    popover.setAttribute(UI_ATTRIBUTE, 'true');
    popover.style.left = `${position.left}px`;
    popover.style.top = `${position.top}px`;
    popover.innerHTML = `
      <div class="aitran-popover-head"><span class="aitran-popover-title"></span><button class="aitran-popover-close">×</button></div>
      <div class="aitran-popover-original"></div>
      <div class="aitran-popover-result aitran-popover-loading">翻译中…</div>
      <button class="aitran-popover-copy" hidden>复制译文</button>
    `;
    popover.querySelector<HTMLElement>('.aitran-popover-title')!.textContent = title;
    popover.querySelector<HTMLElement>('.aitran-popover-original')!.textContent = text;
    popover.querySelector<HTMLButtonElement>('.aitran-popover-close')!.addEventListener('click', () => popover.remove());
    document.documentElement.append(popover);
    this.popover = popover;

    const resultElement = popover.querySelector<HTMLElement>('.aitran-popover-result')!;
    const copyButton = popover.querySelector<HTMLButtonElement>('.aitran-popover-copy')!;
    try {
      const scene = title.includes('悬停') ? 'hover' : 'selection';
      const translation = await this.translateText(text, scene);
      if (!popover.isConnected) return;
      resultElement.classList.remove('aitran-popover-loading');
      resultElement.textContent = translation;
      copyButton.hidden = false;
      copyButton.addEventListener('click', async () => {
        await navigator.clipboard.writeText(translation);
        copyButton.textContent = '已复制';
      });
    } catch (error) {
      resultElement.classList.remove('aitran-popover-loading');
      resultElement.textContent = `翻译失败：${errorMessage(error)}`;
    }
  }

  private removeSelectionTrigger(): void {
    this.selectionTrigger?.remove();
    this.selectionTrigger = undefined;
  }
}
