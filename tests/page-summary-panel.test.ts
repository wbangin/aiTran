// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { PageSummaryPanel, renderSummary } from '../src/ui/page-summary';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { normalizeCustomProviderConfig } from '../src/shared/prompts';
import type { PageSummaryResponse, RuntimeMessage, Settings } from '../src/shared/types';

vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage: vi.fn() } } }));
const sendMessage = vi.mocked(browser.runtime.sendMessage);
const aiSettings: Settings = { ...DEFAULT_SETTINGS, customProviders: [normalizeCustomProviderConfig({ id: 'test', name: 'My AI', url: 'https://example.com', protocol: 'openai-compatible', model: 'test' })] };

beforeEach(() => {
  document.querySelector('#aitran-page-summary')?.remove();
  document.body.innerHTML = '<article><h1>Test article</h1><p>Important source text.</p></article>';
  sendMessage.mockReset();
});

describe('page summary panel', () => {
  it('offers configuration when there is no AI service and does not send page content', async () => {
    sendMessage.mockImplementation(async () => DEFAULT_SETTINGS);
    new PageSummaryPanel().open();
    const root = document.querySelector('#aitran-page-summary')!.shadowRoot!;
    await vi.waitFor(() => expect(root.querySelector('.status')?.textContent).toContain('配置 AI 服务'));
    expect(root.querySelector<HTMLButtonElement>('.generate')!.disabled).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps a running summary when closed and reopened, then supports retry', async () => {
    let resolveSummary!: (result: PageSummaryResponse) => void;
    sendMessage.mockImplementation(async (raw: unknown) => {
      const message = raw as RuntimeMessage;
      if (message.type === 'GET_SETTINGS') return aiSettings;
      if (message.type === 'SUMMARIZE_PAGE') return await new Promise<PageSummaryResponse>((resolve) => { resolveSummary = resolve; });
      return undefined;
    });
    const panel = new PageSummaryPanel();
    panel.open();
    const host = document.querySelector<HTMLElement>('#aitran-page-summary')!;
    const root = host.shadowRoot!;
    await vi.waitFor(() => expect(root.querySelector<HTMLButtonElement>('.generate')!.disabled).toBe(false));
    root.querySelector<HTMLButtonElement>('.generate')!.click();
    root.querySelector<HTMLButtonElement>('.close')!.click();
    expect(host.style.display).toBe('none');
    panel.open();
    expect(host.style.display).toBe('block');
    expect(root.querySelector<HTMLButtonElement>('.generate')!.disabled).toBe(true);
    resolveSummary({ ok: false, error: 'Temporary service error' });
    await vi.waitFor(() => expect(root.querySelector('.generate')?.textContent).toBe('重试总结'));
    root.querySelector<HTMLButtonElement>('.generate')!.click();
    resolveSummary({ ok: true, summary: '## 核心结论\n- **重要**信息', providerName: 'My AI' });
    await vi.waitFor(() => expect(root.querySelector('.result h3')?.textContent).toBe('核心结论'));
    expect(root.querySelector('.result strong')?.textContent).toBe('重要');
    expect(root.querySelector<HTMLButtonElement>('.copy')!.disabled).toBe(false);
  });

  it('renders model output as text rather than executable HTML', () => {
    const container = document.createElement('div');
    renderSummary(container, '## Summary\n- <img src=x onerror=alert(1)>\n<script>alert(1)</script>');
    expect(container.querySelector('img,script')).toBeNull();
    expect(container.textContent).toContain('<script>');
  });

  it('shows only summary configuration before generation but still sends current page content on request', async () => {
    document.title = 'Private page title';
    sendMessage.mockImplementation(async (raw: unknown) => {
      const message = raw as RuntimeMessage;
      if (message.type === 'GET_SETTINGS') return aiSettings;
      if (message.type === 'SUMMARIZE_PAGE') return { ok: true, summary: 'Key points', providerName: 'My AI' };
    });
    new PageSummaryPanel().open();
    const root = document.querySelector('#aitran-page-summary')!.shadowRoot!;
    await vi.waitFor(() => expect(root.querySelector<HTMLButtonElement>('.generate')!.disabled).toBe(false));
    expect(root.querySelector('.page-title,.character-count,.source-label')).toBeNull();
    expect(root.textContent).not.toContain('Private page title');
    expect(root.textContent).not.toContain('Important source text.');
    expect(root.querySelector('.status')!.textContent).toBe('');
    expect(root.querySelector<HTMLElement>('.copy')!.hidden).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    root.querySelector<HTMLSelectElement>('.language')!.value = 'en';
    document.querySelector('article p')!.textContent = 'Fresh content after opening.';
    root.querySelector<HTMLButtonElement>('.generate')!.click();
    await vi.waitFor(() => expect(root.querySelector('.result')!.textContent).toBe('Key points'));
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUMMARIZE_PAGE', request: expect.objectContaining({
      title: 'Private page title', text: expect.stringContaining('Fresh content after opening.'), targetLanguage: 'en', providerId: 'custom:test'
    }) }));
    expect(root.querySelector<HTMLElement>('.copy')!.hidden).toBe(false);
  });

  it('keeps truncation disclosure without displaying the source preview', async () => {
    document.querySelector('article p')!.textContent = 'Source content. '.repeat(2500);
    sendMessage.mockImplementation(async () => aiSettings);
    new PageSummaryPanel().open();
    const root = document.querySelector('#aitran-page-summary')!.shadowRoot!;
    await vi.waitFor(() => expect(root.querySelector<HTMLButtonElement>('.generate')!.disabled).toBe(false));
    expect(root.querySelector<HTMLElement>('.notice')!.hidden).toBe(false);
    expect(root.querySelector('.notice')!.textContent).toContain('24,000');
    expect(root.querySelector('.source-label')).toBeNull();
  });

  it('collapses settings after generation, supports adjustment and clears stale results on configuration changes', async () => {
    sendMessage.mockImplementation(async (raw: unknown) => (raw as RuntimeMessage).type === 'GET_SETTINGS' ? aiSettings : { ok: true, summary: '## 核心结论\nA conclusion.\n## 关键要点\n- First point', providerName: 'My AI' });
    new PageSummaryPanel().open();
    const root = document.querySelector('#aitran-page-summary')!.shadowRoot!;
    const get = <T extends HTMLElement = HTMLButtonElement>(selector: string) => root.querySelector<T>(selector)!;
    await vi.waitFor(() => expect(get<HTMLButtonElement>('.generate').disabled).toBe(false));
    get('.generate').click();
    await vi.waitFor(() => expect(get('.configuration').hidden).toBe(true));
    expect(get('.result-meta').hidden).toBe(false);
    expect(get('.result-context').textContent).toContain('My AI · 简体中文');
    expect(get('.result-actions').hidden).toBe(false);
    expect(get('.summary-lead').textContent).toBe('核心结论A conclusion.');
    expect(root.querySelector('.summary-lead ul')).toBeNull();
    get('.adjust').click();
    expect(get('.configuration').hidden).toBe(false);
    expect(get('.adjust').getAttribute('aria-expanded')).toBe('true');
    get<HTMLSelectElement>('.language').value = 'en';
    get('.language').dispatchEvent(new Event('change'));
    expect(get('.result-meta').hidden).toBe(true);
    expect(get('.result').textContent).toBe('');
    expect(get('.copy').hidden).toBe(true);
    get('.generate').click();
    await vi.waitFor(() => expect(get('.result-context').textContent).toContain('English'));
    get('.regenerate').click();
    await vi.waitFor(() => expect(get('.configuration').hidden).toBe(true));
    expect(sendMessage.mock.calls.filter(([raw]) => (raw as unknown as RuntimeMessage).type === 'SUMMARIZE_PAGE')).toHaveLength(3);
  });
});
