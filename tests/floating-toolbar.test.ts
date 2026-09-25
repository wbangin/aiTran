// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { FloatingToolbar } from '../src/ui/floating-toolbar';
import { InteractiveTranslator } from '../src/core/interactive-translator';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage: vi.fn() } } }));
let toolbar: FloatingToolbar | undefined;
const root = () => document.querySelector('#aitran-floating-toolbar')!.shadowRoot!;
const get = <T extends HTMLElement = HTMLButtonElement>(selector: string) => root().querySelector<T>(selector)!;
afterEach(() => { toolbar?.dispose(); toolbar = undefined; document.querySelector('#aitran-floating-toolbar')?.remove(); vi.clearAllMocks(); });

describe('single floating toolbar', () => {
  it('applies default transparency and updates the same toolbar on settings refresh', () => {
    toolbar = new FloatingToolbar(DEFAULT_SETTINGS, vi.fn(), vi.fn());
    const ball = get('.ball');
    expect(ball.style.getPropertyValue('--ball-alpha')).toBe('0.6');
    toolbar.applySettings({ ...DEFAULT_SETTINGS, floatingBallTransparency: 70 });
    expect(get('.ball')).toBe(ball);
    expect(Number(ball.style.getPropertyValue('--ball-alpha'))).toBeCloseTo(0.3);
    toolbar.applySettings({ ...DEFAULT_SETTINGS, floatingBallTransparency: 0 });
    expect(ball.style.getPropertyValue('--ball-alpha')).toBe('1');
    expect(get('.tools').style.opacity).toBe('');
  });

  it('uses an AiT entry, three icon-only controls and outside/Escape dismissal', () => {
    toolbar = new FloatingToolbar(DEFAULT_SETTINGS, vi.fn(), vi.fn());
    expect(get('.ball').textContent).toBe('AiT');
    expect(get('.tools').hidden).toBe(true);
    get('.ball').click();
    expect(get('.tools').hidden).toBe(false);
    for (const button of root().querySelectorAll('.action')) {
      expect(button.textContent).toBe(''); expect(button.getAttribute('aria-label')).toBeTruthy(); expect(button.querySelector('svg')).not.toBeNull();
    }
    get('.mode').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(get('.tools').hidden).toBe(true);
    get('.ball').click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(get('.tools').hidden).toBe(true);
  });

  it('switches mode through the background without overwriting unrelated settings', async () => {
    vi.mocked(browser.runtime.sendMessage).mockImplementation(async () => ({ ...DEFAULT_SETTINGS, displayMode: 'translation-only' }));
    toolbar = new FloatingToolbar(DEFAULT_SETTINGS, vi.fn(), vi.fn());
    get('.ball').click(); get('.mode').click();
    await vi.waitFor(() => expect(get('.mode').getAttribute('aria-label')).toContain('当前仅译文'));
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'SET_DISPLAY_MODE', displayMode: 'translation-only' });
    expect(get('.tools').hidden).toBe(false);
  });

  it('preserves status and surfaces action failures instead of silently failing', async () => {
    const translate = vi.fn().mockResolvedValue({ translated: true });
    const summarize = vi.fn().mockResolvedValue({ ok: false, error: '请刷新网页' });
    toolbar = new FloatingToolbar(DEFAULT_SETTINGS, translate, summarize);
    toolbar.setPageState(false, true);
    expect(get<HTMLButtonElement>('.translate').disabled).toBe(true);
    toolbar.setPageState(true);
    expect(get('.translate').getAttribute('aria-label')).toBe('显示原文');
    get('.ball').click(); get('.translate').click();
    await vi.waitFor(() => expect(get<HTMLButtonElement>('.summary').disabled).toBe(false));
    expect(translate).toHaveBeenCalledOnce(); expect(get('.tools').hidden).toBe(true);
    get('.ball').click(); get('.summary').click();
    await vi.waitFor(() => expect(get('.error').textContent).toBe('请刷新网页'));
    expect(get('.error').hidden).toBe(false);
  });

  it('keeps one toolbar across setting refreshes and removes it when disabled', () => {
    const interactive = new InteractiveTranslator(DEFAULT_SETTINGS, vi.fn(), vi.fn());
    interactive.applySettings(DEFAULT_SETTINGS);
    expect(document.querySelectorAll('#aitran-floating-toolbar')).toHaveLength(1);
    expect(document.querySelector('.aitran-summary-ball,.aitran-float-ball')).toBeNull();
    interactive.applySettings({ ...DEFAULT_SETTINGS, floatingBall: false });
    expect(document.querySelector('#aitran-floating-toolbar')).toBeNull();
  });
});
