// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { collectTranslationBlocks } from '../src/core/dom';

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
      'feat: update version to 0.0.5 in wxt.config.ts'
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
