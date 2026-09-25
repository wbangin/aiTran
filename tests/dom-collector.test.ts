// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { collectTranslationBlocks, isDeveloperConsolePage } from '../src/core/dom';

beforeEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return { x: 0, y: 0, width: 320, height: 24, top: 0, right: 320, bottom: 24, left: 0, toJSON() {} };
    }
  });
});

describe('DOM block collection', () => {
  it('targets only the Chrome publisher dashboard for application labels', () => {
    expect(isDeveloperConsolePage('https://chrome.google.com/webstore/devconsole/publisher/settings?evr=SUCCESS')).toBe(true);
    expect(isDeveloperConsolePage('https://chrome.google.com/webstore/detail/extension')).toBe(false);
    expect(isDeveloperConsolePage('https://chrome.google.com.evil.test/webstore/devconsole/x/settings')).toBe(false);
    expect(isDeveloperConsolePage('http://chrome.google.com/webstore/devconsole/x/settings')).toBe(false);
  });

  it('collects dashboard navigation, short labels and controls without including fields or decorative icons', () => {
    document.body.innerHTML = `
      <header class="app-header"><strong>Chrome Web Store Developer Dashboard</strong></header>
      <nav role="navigation"><a href="/items">Items</a><a href="/settings"><span>Settings</span></a></nav>
      <main><div class="settings-header">Trader declaration</div>
        <p>Declare whether your publisher account is considered a trader.</p>
        <button id="edit">Edit</button>
        <div role="button" id="address"><span>Enter address</span></div>
        <label><input type="radio" name="trader" />This is a non-trader account</label>
        <span aria-hidden="true">Private icon</span>
        <input value="secret" aria-label="Publisher email" />
        <div contenteditable="true">Private draft</div>
      </main>`;
    const blocks = collectTranslationBlocks(document.body, true);
    expect(blocks.map((block) => block.text)).toEqual([
      'Chrome Web Store Developer Dashboard', 'Items', 'Settings', 'Trader declaration',
      'Declare whether your publisher account is considered a trader.', 'Edit', 'Enter address',
      'This is a non-trader account'
    ]);
    expect(blocks.find((block) => block.text === 'Settings')?.placement).toBe('inside');
    expect(blocks.map((block) => block.text).join(' ')).not.toMatch(/secret|Private/);
  });
  it.each(['flex', 'grid'])('keeps %s workflow cards out of translation blocks', (display) => {
    document.body.innerHTML = `<aside><ul><li id="workflow" style="display:${display}">
      <span aria-hidden="true">Python icon</span>
      <div><strong>Publish Python Package</strong><p>Publish a Python Package to PyPI on release.</p><span>By GitHub Actions</span></div>
      <button>Configure</button>
    </li></ul></aside>`;
    const blocks = collectTranslationBlocks();
    expect(blocks.map((block) => block.text)).toEqual([
      'Publish Python Package', 'Publish a Python Package to PyPI on release.', 'By GitHub Actions'
    ]);
    expect(blocks.every((block) => block.kind === 'compact' && block.placement === 'inside')).toBe(true);
    expect(blocks.some((block) => block.element.id === 'workflow')).toBe(false);
  });

  it('preserves short inline-wrapped titles without absorbing a neighbouring control', () => {
    document.body.innerHTML = `<aside><div style="display:flex">
      <div><div><strong>Django</strong></div><div>Build and Test a Django Project</div></div>
      <a class="btn">Configure</a>
    </div></aside>`;
    expect(collectTranslationBlocks().map((block) => block.text)).toEqual(['Django', 'Build and Test a Django Project']);
  });

  it('keeps inline emphasis in generic text and does not re-collect translated ancestors', () => {
    document.body.innerHTML = `<aside><div>Build and Test a <strong>Django</strong> Project</div></aside>
      <article><li>Introduction to this item.<p data-aitran-translated="true">The nested paragraph is already translated.</p></li></article>`;
    expect(collectTranslationBlocks().map((block) => block.text)).toEqual(['Build and Test a Django Project']);
  });

  it('does not collect semantic layout containers or overlapping ancestor blocks', () => {
    document.body.innerHTML = `<article>
      <h2 style="display:flex">This layout heading has no safe text wrapper</h2>
      <ul><li>Introduction to this item.<p>The nested paragraph should only be translated once.</p></li></ul>
      <p>Run <strong>the application</strong> to begin translating.</p>
    </article>`;
    expect(collectTranslationBlocks().map((block) => block.text)).toEqual([
      'The nested paragraph should only be translated once.',
      'Run the application to begin translating.'
    ]);
  });

  it('translates GitHub repository descriptions without translating navigation and controls', () => {
    document.body.innerHTML = `
      <header>
        <nav><a>Code</a><a>Issues</a><a>Pull requests</a><a>Actions</a></nav>
      </header>
      <main>
        <div class="repository-toolbar"><button>Add file</button><button>Code</button></div>
        <h1><a href="/n4ze3m/page-assist">page-assist</a></h1>
        <div class="react-directory-row" style="display:grid">
          <a>.github</a><span>Add support and sponsorship options</span><span>2 years ago</span>
        </div>
        <table><tbody><tr><td>extensions/page-action</td><td>feat: update version to 0.0.5 in wxt.config.ts</td></tr></tbody></table>
        <article class="markdown-body">
          <h1>Use your local AI models in the browser</h1>
          <p>Page Assist helps you use locally running AI models while browsing the web.</p>
          <ul><li>Open the settings page and choose the model you want to use.</li></ul>
        </article>
      </main>
      <aside><h2>About</h2><p>Use your locally running AI models to assist you in your web browsing.</p></aside>
    `;

    const blocks = collectTranslationBlocks();
    expect(blocks.map((block) => block.text)).toEqual([
      'Add support and sponsorship options',
      'feat: update version to 0.0.5 in wxt.config.ts',
      'Use your local AI models in the browser',
      'Page Assist helps you use locally running AI models while browsing the web.',
      'Open the settings page and choose the model you want to use.',
      'Use your locally running AI models to assist you in your web browsing.'
    ]);
    expect(blocks.filter((block) => block.kind === 'compact').map((block) => block.text)).toEqual([
      'Add support and sponsorship options',
      'feat: update version to 0.0.5 in wxt.config.ts',
      'Use your locally running AI models to assist you in your web browsing.'
    ]);
  });

  it('translates sentence-like table cells compactly outside articles', () => {
    document.body.innerHTML = `
      <table><tbody><tr><td>This repository control should remain untouched.</td></tr></tbody></table>
      <article class="markdown-body">
        <table><tbody><tr><td>This article table cell contains useful explanatory content.</td></tr></tbody></table>
      </article>
    `;
    const blocks = collectTranslationBlocks();
    expect(blocks.map((block) => block.text)).toEqual([
      'This repository control should remain untouched.',
      'This article table cell contains useful explanatory content.'
    ]);
    expect(blocks.map((block) => block.kind)).toEqual(['compact', 'table-cell']);
  });

  it('uses a leaf generic text container but not a flex/grid application control', () => {
    document.body.innerHTML = `
      <main>
        <div>This standalone content sentence is long enough to be translated safely.</div>
        <div style="display:flex">This flex application row should not receive an inserted translation.</div>
        <div style="display:grid">This grid application row should not receive an inserted translation.</div>
      </main>
    `;
    const blocks = collectTranslationBlocks();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('compact');
    expect(blocks[0]?.text).toContain('standalone content sentence');
  });
});

describe('email and reading-surface collection', () => {
  it('translates short greetings and all meaningful email paragraphs', () => {
    document.body.dataset.aitranReadingSurface = 'true';
    document.body.innerHTML = `
      <table role="presentation"><tbody><tr><td>
        <header class="message-header"><h2>NVIDIA DriveOS 7.2.5 Now Available</h2></header>
        <div>Hello,</div>
        <div>DriveOS 7.2.5 Linux is now available for DRIVE AGX Thor. This release includes:</div>
        <ul>
          <li>Updated core platform components: Ubuntu 24.04, Linux Kernel 6.8, CUDA 13.2, and Yocto 5.0.</li>
          <li>Improved inference performance and on-device LLM support.</li>
        </ul>
        <div>Ready to get started?</div>
        <footer class="message-footer"><div>Thank you for reading.</div></footer>
      </td></tr></tbody></table>
    `;

    const texts = collectTranslationBlocks().map((block) => block.text);
    expect(texts).toEqual([
      'NVIDIA DriveOS 7.2.5 Now Available',
      'Hello,',
      'DriveOS 7.2.5 Linux is now available for DRIVE AGX Thor. This release includes:',
      'Updated core platform components: Ubuntu 24.04, Linux Kernel 6.8, CUDA 13.2, and Yocto 5.0.',
      'Improved inference performance and on-device LLM support.',
      'Ready to get started?',
      'Thank you for reading.'
    ]);
    delete document.body.dataset.aitranReadingSurface;
  });
});

describe('source-code protection', () => {
  it('skips fenced README code blocks whose text is nested in syntax-highlight spans', () => {
    document.body.innerHTML = `
      <article class="markdown-body">
        <p>Attach TemporalDurability to the agent before starting the durable workflow.</p>
        <div class="highlight highlight-source-python">
          <pre><code><span>from temporalio import workflow</span>
<span>agent = Agent('openai:gpt-5.6-sol')</span>
<span>async def run(self, topic: str) -&gt; str:</span></code></pre>
        </div>
        <p>Build this integration by following the durable execution guide.</p>
      </article>
    `;

    expect(collectTranslationBlocks().map((block) => block.text)).toEqual([
      'Attach TemporalDurability to the agent before starting the durable workflow.',
      'Build this integration by following the durable execution guide.'
    ]);
  });

  it('skips GitHub source rows and browser code-editor surfaces', () => {
    document.body.innerHTML = `
      <main>
        <table><tbody><tr>
          <td class="blob-code"><span class="blob-code-inner">const translated = await translatePage();</span></td>
        </tr></tbody></table>
        <div class="react-code-line"><span>return result.output</span></div>
        <div class="monaco-editor"><div class="view-line"><span>function main() {}</span></div></div>
        <p>This explanatory paragraph should still be translated normally.</p>
      </main>
    `;

    expect(collectTranslationBlocks().map((block) => block.text)).toEqual([
      'This explanatory paragraph should still be translated normally.'
    ]);
  });

  it('protects inline code while retaining the surrounding README sentence', () => {
    document.body.innerHTML = `
      <article class="markdown-body">
        <p>Run <code>uv add "pydantic-ai[temporal]"</code> before starting the workflow.</p>
      </article>
    `;

    const [block] = collectTranslationBlocks();
    expect(block?.text).toBe('Run __AITRAN_CODE_0__ before starting the workflow.');
    expect(block?.protectedFragments).toEqual([
      { token: '__AITRAN_CODE_0__', text: 'uv add "pydantic-ai[temporal]"' }
    ]);
  });
});
