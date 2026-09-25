// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { collectPageContent } from '../src/core/page-content';
import { MAX_SUMMARY_CHARACTERS } from '../src/shared/summary';

beforeEach(() => { document.body.innerHTML = ''; document.title = 'Test article'; });

describe('page summary content collection', () => {
  it('reads original article text and excludes controls, hidden content, and extension UI', () => {
    document.body.innerHTML = `<nav>Navigation</nav><main><h1>Article title</h1>
      <p>${'Useful article content. '.repeat(10)}</p>
      <p style="display:none" data-aitran-original-display="">Hidden original</p>
      <span class="aitran-translation">Existing translation</span>
      <div data-aitran-ui>Summary panel</div><input value="Secret input"><textarea>Secret draft</textarea>
      <div contenteditable="true">Editable draft</div><p hidden>Hidden text</p>
      <div style="display:none"><article>${'Hidden article. '.repeat(50)}</article></div>
      <script>doNotRead()</script><footer>Footer links</footer></main><aside>Related posts</aside>`;
    const result = collectPageContent();
    expect(result.title).toBe('Test article');
    expect(result.text).toContain('Article title\nUseful article content.');
    expect(result.text).toContain('Hidden original');
    expect(result.text).not.toMatch(/Navigation|Existing translation|Summary panel|Secret|Editable|Hidden text|Hidden article|doNotRead|Footer|Related/);
    expect(result.truncated).toBe(false);
  });

  it('caps very long pages and explicitly reports truncation', () => {
    const article = document.createElement('article');
    article.textContent = 'A'.repeat(MAX_SUMMARY_CHARACTERS + 1000);
    document.body.append(article);
    const result = collectPageContent();
    expect(result.text).toHaveLength(MAX_SUMMARY_CHARACTERS);
    expect(result.truncated).toBe(true);
  });

  it('can read pages without an article element and preserves inline text', () => {
    document.body.innerHTML = '<div>Hello <strong>world</strong>!</div><div>Another paragraph.</div>';
    expect(collectPageContent().text).toBe('Hello world!\nAnother paragraph.');
  });
});
