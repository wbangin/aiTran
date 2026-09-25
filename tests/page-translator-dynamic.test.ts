// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { PageTranslator } from '../src/core/page-translator';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { RuntimeMessage, Settings } from '../src/shared/types';

vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage: vi.fn() } } }));

const sendMessage = vi.mocked(browser.runtime.sendMessage);
let settings: Settings;

beforeEach(() => {
  settings = { ...DEFAULT_SETTINGS };
  document.body.innerHTML = '<article><p id="source">This is the first paragraph for translation.</p></article>';
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return { x: 0, y: 0, width: 320, height: 24, top: 0, right: 320, bottom: 24, left: 0, toJSON() {} };
    }
  });
  sendMessage.mockReset();
  sendMessage.mockImplementation(async (rawMessage: unknown) => {
    const message = rawMessage as RuntimeMessage;
    if (message.type === 'GET_SETTINGS') return settings;
    if (message.type === 'TRANSLATE_BATCH') return {
      translations: message.request.texts.map((text) => `译：${text}`),
      providerId: message.request.providerId,
      cachedCount: 0
    };
    if (message.type === 'REPORT_PAGE_STATUS') return message.status;
    return undefined;
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('dynamic page translation', () => {
  it('translates a long list across request batches without losing or repeating entries', async () => {
    document.body.innerHTML = `<article><ol>${Array.from({ length: 25 }, (_, index) =>
      `<li id="item-${index}">Step ${index + 1}: review the extension release checklist carefully.</li>`).join('')}</ol></article>`;
    const translator = new PageTranslator();
    await translator.translatePage();
    const requests = sendMessage.mock.calls.map(([raw]) => raw as unknown as RuntimeMessage)
      .filter((message): message is Extract<RuntimeMessage, { type: 'TRANSLATE_BATCH' }> => message.type === 'TRANSLATE_BATCH');
    expect(requests.map((request) => request.request.texts.length)).toEqual([20, 5]);
    expect(new Set(requests.flatMap((request) => request.request.texts)).size).toBe(25);
    expect(document.querySelectorAll('.aitran-translation')).toHaveLength(25);
    expect(translator.getStatus().translatedBlocks).toBe(25);
    translator.restorePage();
    expect(document.querySelectorAll('.aitran-translation')).toHaveLength(0);
  });

  it('translates open web components, tracks late content and restores both roots', async () => {
    document.body.replaceChildren();
    const host = document.createElement('news-card');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<p id="shadow-copy">Initial web component story for readers.</p>';
    document.body.append(host);
    expect(root.querySelector('p')?.isConnected).toBe(true);
    const translator = new PageTranslator();
    await translator.translatePage();
    expect(root.querySelector('#aitran-content-styles')).not.toBeNull();
    expect(root.querySelector('.aitran-translation')?.textContent).toBe('译：Initial web component story for readers.');
    expect(translator.getStatus().translatedBlocks).toBe(1);

    const source = root.querySelector<HTMLElement>('#shadow-copy')!;
    source.firstChild!.textContent = 'Updated web component story for readers.';
    await vi.waitFor(() => expect(root.querySelector('.aitran-translation')?.textContent).toBe('译：Updated web component story for readers.'), { timeout: 2000 });

    const lateHost = document.createElement('article-card');
    const lateRoot = lateHost.attachShadow({ mode: 'open' });
    lateRoot.innerHTML = '<p>Fresh article card added after page translation.</p>';
    document.body.append(lateHost);
    await vi.waitFor(() => expect(lateRoot.querySelector('.aitran-translation')?.textContent).toBe('译：Fresh article card added after page translation.'), { timeout: 2000 });
    expect(translator.getStatus().translatedBlocks).toBe(2);

    settings = { ...settings, displayMode: 'translation-only' };
    await translator.refreshSettings();
    expect(source.style.display).toBe('none');
    expect(lateRoot.querySelector<HTMLElement>('p')!.style.display).toBe('none');
    translator.restorePage();
    expect(source.style.display).not.toBe('none');
    expect(lateRoot.querySelector<HTMLElement>('p')!.style.display).not.toBe('none');
    expect(root.querySelector('.aitran-translation')).toBeNull();
    expect(lateRoot.querySelector('.aitran-translation')).toBeNull();
    expect(translator.getStatus().translatedBlocks).toBe(0);
  });

  it('keeps inline code untouched while rendering and restoring surrounding prose', async () => {
    document.body.innerHTML = '<article><p id="guide">Run <code>npm run release</code> after the tests pass.</p></article>';
    const original = document.body.innerHTML;
    const translator = new PageTranslator();
    await translator.translatePage();
    const translation = document.querySelector<HTMLElement>('.aitran-translation')!;
    expect(translation.textContent).toContain('npm run release');
    expect(translation.textContent).not.toContain('__AITRAN_CODE_');
    expect(translation.getAttribute('lang')).toBe('zh-CN');
    expect(document.querySelector('code')?.textContent).toBe('npm run release');
    translator.restorePage();
    expect(document.body.innerHTML).toBe(original);
  });

  it('removes pending markers after provider errors and translates on retry', async () => {
    let fails = true;
    sendMessage.mockImplementation(async (rawMessage: unknown) => {
      const message = rawMessage as RuntimeMessage;
      if (message.type === 'GET_SETTINGS') return settings;
      if (message.type === 'TRANSLATE_BATCH') {
        if (fails) throw new Error('Service temporarily unavailable');
        return { translations: message.request.texts.map((text) => `译：${text}`), providerId: message.request.providerId, cachedCount: 0 };
      }
      if (message.type === 'REPORT_PAGE_STATUS') return message.status;
    });
    const translator = new PageTranslator();
    await translator.translatePage();
    expect(translator.getStatus().error).toContain('Service temporarily unavailable');
    expect(document.querySelector('[data-aitran-state="pending"]')).toBeNull();
    fails = false;
    await translator.translatePage();
    expect(document.querySelector('.aitran-translation')?.textContent).toContain('first paragraph');
    expect(translator.getStatus().translatedBlocks).toBe(1);
    translator.restorePage();
  });

  it('keeps dashboard links and buttons operable in both display modes', async () => {
    document.body.innerHTML = `<nav role="navigation"><a id="settings" href="/settings"><span>Settings</span></a></nav>
      <main><button id="edit">Edit</button><p>Declare whether your publisher account is considered a trader.</p>
      <label id="trader"><input type="radio" name="status" />This is a non-trader account</label></main>`;
    const original = document.body.innerHTML;
    const link = document.querySelector<HTMLAnchorElement>('#settings')!;
    const button = document.querySelector<HTMLButtonElement>('#edit')!;
    const radio = document.querySelector<HTMLInputElement>('#trader input')!;
    const clicked = vi.fn();
    link.addEventListener('click', (event) => { event.preventDefault(); clicked('link'); });
    button.addEventListener('click', () => clicked('button'));
    const translator = new PageTranslator();
    // The live dashboard URL is not needed to verify its DOM behavior.
    vi.spyOn(window, 'location', 'get').mockImplementation(() => ({ href: 'https://chrome.google.com/webstore/devconsole/p/settings' }) as Location);
    await translator.translatePage();
    expect(link.querySelector('.aitran-translation')?.textContent).toBe('译：Settings');
    expect(button.querySelector('.aitran-translation')?.textContent).toBe('译：Edit');
    expect(document.querySelector('#trader .aitran-translation')?.textContent).toBe('译：This is a non-trader account');
    settings = { ...settings, displayMode: 'translation-only' };
    await translator.refreshSettings();
    expect(link.style.display).not.toBe('none');
    expect(button.style.display).not.toBe('none');
    expect(document.querySelector<HTMLElement>('#trader')!.style.display).not.toBe('none');
    link.click();
    button.click();
    radio.click();
    expect(clicked.mock.calls).toEqual([['link'], ['button']]);
    expect(radio.checked).toBe(true);
    translator.restorePage();
    expect(document.body.innerHTML).toBe(original);
    vi.restoreAllMocks();
  });
  it.each(['flex', 'grid'])('preserves %s card structure across translation modes and restore', async (display) => {
    document.body.innerHTML = `<aside><ul><li id="card" style="display:${display};flex-wrap:nowrap">
      <span id="icon" aria-hidden="true">Python icon</span>
      <div id="copy" style="min-width:0;flex:1"><strong>Publish Python Package</strong><p>Publish a Python Package to PyPI on release.</p><span>By GitHub Actions</span></div>
      <button id="configure">Configure</button>
    </li></ul></aside>`;
    const initial = document.body.innerHTML;
    const card = document.querySelector<HTMLElement>('#card')!;
    const copy = document.querySelector<HTMLElement>('#copy')!;
    const button = document.querySelector<HTMLButtonElement>('#configure')!;
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    const translator = new PageTranslator();
    await translator.translatePage();
    expect(card.children).toHaveLength(3);
    expect(copy.querySelectorAll('.aitran-translation')).toHaveLength(3);
    expect(card.querySelector(':scope > .aitran-translation')).toBeNull();
    expect(copy.textContent).not.toContain('Configure');

    settings = { ...settings, displayMode: 'translation-only' };
    await translator.refreshSettings();
    expect(card.style.display).toBe(display);
    expect(copy.style.display).not.toBe('none');
    expect(button.style.display).not.toBe('none');
    expect(card.children).toHaveLength(3);
    button.click();
    expect(onClick).toHaveBeenCalledOnce();

    settings = { ...settings, displayMode: 'bilingual' };
    await translator.refreshSettings();
    expect(copy.querySelectorAll('.aitran-translation')).toHaveLength(3);
    expect(card.children).toHaveLength(3);
    translator.restorePage();
    expect(document.body.innerHTML).toBe(initial);
  });

  it('replaces stale translations after text and child updates, including translation-only mode', async () => {
    const translator = new PageTranslator();
    await translator.translatePage();
    const source = document.querySelector<HTMLElement>('#source')!;
    expect(document.querySelector('.aitran-translation')?.textContent).toContain('first paragraph');

    source.firstChild!.textContent = 'This is the second paragraph for translation.';
    await vi.waitFor(() => {
      expect(document.querySelector('.aitran-translation')?.textContent).toContain('second paragraph');
    }, { timeout: 2000 });
    expect(document.querySelectorAll('.aitran-translation')).toHaveLength(1);

    settings = { ...settings, displayMode: 'translation-only' };
    await translator.refreshSettings();
    expect(source.style.display).toBe('none');
    source.replaceChildren(document.createTextNode('This is the third paragraph for translation.'));
    await vi.waitFor(() => {
      expect(document.querySelector('.aitran-translation')?.textContent).toContain('third paragraph');
    }, { timeout: 2000 });
    expect(document.querySelectorAll('.aitran-translation')).toHaveLength(1);
    expect(source.style.display).toBe('none');
    expect(translator.getStatus().translatedBlocks).toBe(1);

    const replacement = document.createElement('p');
    replacement.textContent = 'This replacement paragraph should be translated too.';
    source.replaceWith(replacement);
    await vi.waitFor(() => {
      expect(document.querySelector('.aitran-translation')?.textContent).toContain('replacement paragraph');
    }, { timeout: 2000 });
    expect(document.querySelectorAll('.aitran-translation')).toHaveLength(1);
    expect(translator.getStatus().translatedBlocks).toBe(1);
    translator.restorePage();
  });
});
