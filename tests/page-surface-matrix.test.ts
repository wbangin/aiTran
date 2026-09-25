// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { collectTranslationBlocks } from '../src/core/dom';

beforeEach(() => {
  document.body.innerHTML = '';
  delete document.body.dataset.aitranReadingSurface;
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return { x: 0, y: 0, width: 320, height: 24, top: 0, right: 320, bottom: 24, left: 0, toJSON() {} };
    }
  });
});

const readingCases = [
  {
    name: 'disclosure and form group: preserve interactive labels and hide collapsed content',
    html: `<main><details><summary>Shipping details</summary><p>Hidden delivery policy for later review.</p></details>
      <details open><summary>Returns policy</summary><p>Customers may return products within thirty days.</p></details>
      <fieldset><legend>Account preferences</legend><input value="private preference" /></fieldset></main>`,
    expected: ['Shipping details', 'Returns policy', 'Customers may return products within thirty days.', 'Account preferences']
  },
  {
    name: 'news article: headings, paragraphs, quote and caption',
    html: `<article><h1>Electric Vehicle Battery Research Update</h1>
      <p>The new battery design improves charging speed in winter conditions.</p>
      <blockquote>Researchers reported more than twenty percent faster charging.</blockquote>
      <figure><img alt="Chart" src="/chart.png"/><figcaption>Charging speed measured at low temperatures.</figcaption></figure></article>`,
    expected: ['Electric Vehicle Battery Research Update', 'The new battery design improves charging speed in winter conditions.',
      'Researchers reported more than twenty percent faster charging.', 'Charging speed measured at low temperatures.']
  },
  {
    name: 'documentation: lists, definition list and table',
    html: `<article><h2>Installation Guide</h2><ul>
      <li>Download the extension package from the official release page.</li>
      <li>Open the browser settings and enable developer mode.</li></ul>
      <dl><dt>Supported browser</dt><dd>Recent versions of Chrome and Firefox.</dd></dl>
      <table><thead><tr><th>Feature description</th></tr></thead><tbody><tr><td>Automatic translation of newly opened web pages.</td></tr></tbody></table></article>`,
    expected: ['Installation Guide', 'Download the extension package from the official release page.',
      'Open the browser settings and enable developer mode.', 'Supported browser', 'Recent versions of Chrome and Firefox.',
      'Feature description', 'Automatic translation of newly opened web pages.']
  },
  {
    name: 'modern card: translate text leaves without changing flex controls',
    html: `<aside><div style="display:grid"><span aria-hidden="true">Icon</span>
      <div><strong>Publish Python Package</strong><p>Publish a Python Package to PyPI on release.</p></div>
      <button>Configure</button></div></aside>`,
    expected: ['Publish Python Package', 'Publish a Python Package to PyPI on release.']
  },
  {
    name: 'navigation and application controls remain untouched on ordinary sites',
    html: `<header><nav><a>Settings</a><button>Sign in</button></nav></header>
      <main><div role="toolbar"><button>Save</button></div><p>This is ordinary reading content that should be translated.</p></main>`,
    expected: ['This is ordinary reading content that should be translated.']
  },
  {
    name: 'forms, credentials and editable drafts are excluded',
    html: `<main><label>Email address<input type="email" value="private@example.com"/></label>
      <input type="password" value="private-password"/><textarea>Private message draft</textarea>
      <div contenteditable="true">Private message content</div>
      <p>Help text explaining how this form processes submitted data.</p></main>`,
    expected: ['Help text explaining how this form processes submitted data.']
  },
  {
    name: 'code, SVG, hidden content and extension UI are excluded',
    html: `<main><pre><code>const token = "private";</code></pre>
      <div class="monaco-editor">Source code editor private content.</div>
      <svg><text>Illustration label</text></svg>
      <p aria-hidden="true">Screen reader decorative copy.</p>
      <p hidden>Hidden account token should never be translated.</p>
      <section inert><p>Inactive dialog private content.</p></section>
      <p translate="no">ProductBrandNeverTranslate</p>
      <p style="display:none">Invisible description that is not displayed.</p>
      <div data-aitran-ui="true"><p>AiTran popup text must never be sent.</p></div>
      <p>Visible guidance for readers outside protected regions.</p></main>`,
    expected: ['Visible guidance for readers outside protected regions.']
  },
  {
    name: 'URLs, file names and punctuation are not prose',
    html: `<article><p>https://example.com/docs/install</p><p>package-lock.json</p>
      <p>*** 2026 ***</p><p>Read the migration guide before updating the extension.</p></article>`,
    expected: ['Read the migration guide before updating the extension.']
  }
];

describe('common page surface matrix', () => {
  it.each(readingCases)('$name', ({ html, expected }) => {
    document.body.innerHTML = html;
    expect(collectTranslationBlocks().map((block) => block.text)).toEqual(expected);
  });

  it('keeps nested iframe documents as independent translation surfaces', () => {
    document.body.innerHTML = '<article><p>Main frame article text remains on the page.</p><iframe title="Embedded article"></iframe></article>';
    expect(collectTranslationBlocks().map((block) => block.text)).toEqual(['Main frame article text remains on the page.']);
    // The content script runs in each supported frame; the parent must never
    // absorb iframe text or treat it as part of an article block.
  });

  it('keeps a long article paragraph while rejecting a similarly long generic layout container', () => {
    const longText = 'The reported findings provide more context for readers. '.repeat(55).trim();
    expect(longText.length).toBeGreaterThan(1800);
    document.body.innerHTML = `<article><p>${longText}</p></article><div>${longText}</div>`;
    expect(collectTranslationBlocks().map((block) => block.text)).toEqual([longText]);
  });

  it('does not claim access to closed shadow roots', () => {
    const host = document.createElement('private-widget');
    host.attachShadow({ mode: 'closed' }).innerHTML = '<p>Private closed component text should not be scanned.</p>';
    document.body.append(host);
    expect(collectTranslationBlocks()).toEqual([]);
  });

  it('includes text in nested open shadow roots but excludes aiTran-owned roots', () => {
    const outer = document.createElement('product-card');
    const outerRoot = outer.attachShadow({ mode: 'open' });
    outerRoot.innerHTML = '<h2>Product release highlights</h2><p>Release notes for the latest browser extension update.</p><inner-card></inner-card>';
    const innerRoot = outerRoot.querySelector('inner-card')!.attachShadow({ mode: 'open' });
    innerRoot.innerHTML = '<p>Nested web component content should also be translated.</p>';
    document.body.append(outer);
    const own = document.createElement('div');
    own.dataset.aitranUi = 'true';
    own.attachShadow({ mode: 'open' }).innerHTML = '<p>Private aiTran interface content.</p>';
    document.body.append(own);
    expect(collectTranslationBlocks().map((block) => block.text)).toEqual([
      'Product release highlights', 'Release notes for the latest browser extension update.',
      'Nested web component content should also be translated.'
    ]);
  });
});
