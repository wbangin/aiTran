const EXCLUDED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'KBD', 'SAMP', 'VAR',
  'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED', 'MATH', 'TEMPLATE'
]);

const SEMANTIC_BLOCK_TAGS = new Set([
  'P', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION', 'DT', 'DD',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH'
]);

const GENERIC_BLOCK_TAGS = new Set(['DIV', 'SECTION', 'SPAN']);
const SAFE_BLOCK_DISPLAYS = new Set(['block', 'list-item', 'table-cell', 'table-caption', 'flow-root']);
const FLEX_DISPLAYS = new Set(['flex', 'inline-flex', 'grid', 'inline-grid']);

const EXCLUDED_ANCESTOR_SELECTOR = [
  'button', 'select', 'textarea', 'input', 'option',
  '[role="button"]', '[role="navigation"]', '[role="menu"]', '[role="menubar"]',
  '[role="toolbar"]', '[role="tablist"]', '[role="tab"]', '[role="search"]',
  '[aria-hidden="true"]', '[translate="no"]', '[data-aitran-ui]', '.aitran-translation',
  'code', 'pre', 'kbd', 'samp', 'var', '[role="code"]', '[data-line-number]', '[data-code-marker]', '[data-testid="code-cell"]',
  '.blob-code', '.blob-code-inner', '.js-file-line', '.react-code-line', '.react-code-text', '.code-line',
  '.highlight', '.highlight-source', '.prism-code', '.shiki', '.monaco-editor', '.CodeMirror', '.cm-editor', '.ace_editor'
].join(',');

const PROTECTED_INLINE_SELECTOR = 'code, kbd, samp, var, [data-aitran-no-translate]';
const PROTECTED_TOKEN_PREFIX = '__AITRAN_CODE_';

const ARTICLE_CONTEXT_SELECTOR = [
  'article', '[role="article"]', '[itemprop="articleBody"]',
  '.markdown-body', '.prose', '.post-content', '.entry-content', '.article-content', '.story-body'
].join(',');

const UI_CLASS_PATTERN = /(?:^|[-_])(nav|menu|toolbar|breadcrumb|tabs?|pagination|header|footer|button|controls?|actions?|dropdown|popover|tooltip)(?:[-_]|$)/i;
const MAX_BLOCK_LENGTH = 1800;
const MIN_BLOCK_LENGTH = 2;
const MIN_GENERIC_LENGTH = 24;

function isSubframeDocument(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isReadingSurface(element: HTMLElement): boolean {
  return isSubframeDocument()
    || document.body?.dataset.aitranReadingSurface === 'true'
    || Boolean(element.closest(ARTICLE_CONTEXT_SELECTOR));
}

export type TranslationBlockKind = 'paragraph' | 'heading' | 'list-item' | 'table-cell' | 'generic' | 'compact';
export type TranslationPlacement = 'after' | 'inside';

export interface ProtectedFragment {
  token: string;
  text: string;
}

export interface TranslationBlock {
  element: HTMLElement;
  text: string;
  kind: TranslationBlockKind;
  placement: TranslationPlacement;
  protectedFragments: ProtectedFragment[];
}

function isVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || (style.opacity !== '' && Number(style.opacity) === 0)) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function hasUiClass(element: HTMLElement): boolean {
  return UI_CLASS_PATTERN.test(`${element.id} ${element.className}`);
}

function isExcluded(element: HTMLElement): boolean {
  if (EXCLUDED_TAGS.has(element.tagName)) return true;
  if (element.matches(EXCLUDED_ANCESTOR_SELECTOR) || element.closest(EXCLUDED_ANCESTOR_SELECTOR)) return true;
  if (element.isContentEditable || element.closest('[contenteditable="true"]')) return true;
  const readingSurface = isReadingSurface(element);
  if (!readingSurface && element.closest('header,nav,footer')) return true;
  if (!readingSurface && hasUiClass(element)) return true;
  return false;
}

function directText(element: HTMLElement): string {
  return normalizeText(Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.nodeValue ?? '')
    .join(' '));
}

function protectedToken(index: number): string {
  return `${PROTECTED_TOKEN_PREFIX}${index}__`;
}

function replaceProtectedInlineElements(clone: HTMLElement): ProtectedFragment[] {
  const protectedFragments: ProtectedFragment[] = [];
  const candidates = Array.from(clone.querySelectorAll<HTMLElement>(PROTECTED_INLINE_SELECTOR));
  for (const candidate of candidates) {
    if (!clone.contains(candidate) || candidate.parentElement?.closest(PROTECTED_INLINE_SELECTOR)) continue;
    const token = protectedToken(protectedFragments.length);
    protectedFragments.push({ token, text: candidate.textContent ?? '' });
    candidate.replaceWith(document.createTextNode(` ${token} `));
  }
  return protectedFragments;
}

function textWithProtectedFragments(element: HTMLElement, directOnly: boolean): { text: string; protectedFragments: ProtectedFragment[] } {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.aitran-translation, [data-aitran-ui]').forEach((node) => node.remove());
  const protectedFragments = replaceProtectedInlineElements(clone);
  const value = directOnly
    ? Array.from(clone.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.nodeValue ?? '').join(' ')
    : clone.innerText || clone.textContent || '';
  return { text: normalizeText(value), protectedFragments };
}

export function restoreProtectedText(value: string, fragments: ProtectedFragment[]): string {
  return fragments.reduce((result, fragment) => result.split(fragment.token).join(fragment.text), value);
}

function linkTextRatio(element: HTMLElement, text: string): number {
  if (!text) return 0;
  const linkText = normalizeText(Array.from(element.querySelectorAll('a'))
    .map((link) => link.textContent ?? '')
    .join(' '));
  return Math.min(1, linkText.length / text.length);
}

function interactiveDescendantCount(element: HTMLElement): number {
  return element.querySelectorAll('button,input,select,textarea,[role="button"],[role="menuitem"],[role="tab"]').length;
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function hasTranslatableText(value: string): boolean {
  const text = normalizeText(value);
  if (text.length < MIN_BLOCK_LENGTH || text.length > MAX_BLOCK_LENGTH) return false;
  if (/^[\d\s\p{P}\p{S}]+$/u.test(text)) return false;
  return /[\p{L}\p{M}]/u.test(text);
}

export function isMeaningfulBlockText(value: string, kind: TranslationBlockKind, relaxed = false): boolean {
  const text = normalizeText(value);
  if (!hasTranslatableText(text)) return false;
  if (/^(?:https?:\/\/|www\.)/i.test(text) || /^[/\\]?[-\w.]+(?:[/\\][-\w.]+)+$/.test(text)) return false;
  if (/^[.#@]?[-\w]+\.(?:js|ts|tsx|jsx|json|md|css|html|yml|yaml|toml|lock)$/i.test(text)) return false;

  const letters = text.match(/[\p{L}\p{M}]/gu)?.length ?? 0;
  const words = text.match(/[\p{L}\p{M}]+/gu)?.length ?? 0;
  const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(text);

  if (!relaxed && (kind === 'generic' || kind === 'compact') && text.length < MIN_GENERIC_LENGTH) return false;
  if (!relaxed && kind === 'table-cell' && text.length < 12) return false;
  if (!relaxed && kind === 'heading' && !hasCjk && /^[.#@]?[\w.-]+$/.test(text) && /[-_.]/.test(text)) return false;
  if (!relaxed && kind === 'heading' && !hasCjk && words === 1 && text.length < 12) return false;
  if (!relaxed && kind !== 'heading' && !hasCjk && words === 1 && text.length < 16) return false;
  return letters >= (hasCjk ? 2 : 4);
}

function kindForElement(element: HTMLElement): TranslationBlockKind | undefined {
  if (/^H[1-6]$/.test(element.tagName)) return 'heading';
  if (element.tagName === 'LI') return 'list-item';
  if (element.tagName === 'TD' || element.tagName === 'TH') return 'table-cell';
  if (['P', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION', 'DT', 'DD'].includes(element.tagName)) return 'paragraph';
  if (GENERIC_BLOCK_TAGS.has(element.tagName)) {
    return isReadingSurface(element) ? 'generic' : 'compact';
  }
  return undefined;
}

function isGenericContentBlock(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  if (FLEX_DISPLAYS.has(style.display)) return false;
  if (element.tagName !== 'SPAN' && style.display && !SAFE_BLOCK_DISPLAYS.has(style.display)) return false;
  if (interactiveDescendantCount(element) > 0) return false;
  if (element.querySelector('p,blockquote,figcaption,h1,h2,h3,h4,h5,h6,li,td,th,div,section')) return false;
  const ownText = directText(element);
  const relaxed = isReadingSurface(element);
  const kind: TranslationBlockKind = relaxed ? 'generic' : 'compact';
  if (!isMeaningfulBlockText(ownText, kind, relaxed)) return false;
  const allText = normalizeText(element.innerText || element.textContent || '');
  if (allText.length > MAX_BLOCK_LENGTH || linkTextRatio(element, allText) > 0.82) return false;
  return true;
}

function nearestTranslationBlock(element: HTMLElement): HTMLElement | undefined {
  let current: HTMLElement | null = element;
  while (current && current !== document.body && current !== document.documentElement) {
    if (isExcluded(current)) return undefined;
    if (SEMANTIC_BLOCK_TAGS.has(current.tagName)) return current;
    if (GENERIC_BLOCK_TAGS.has(current.tagName) && isGenericContentBlock(current)) return current;
    current = current.parentElement;
  }
  return undefined;
}

function placementForElement(element: HTMLElement, kind: TranslationBlockKind): TranslationPlacement {
  if (kind === 'compact') return 'inside';
  const parentDisplay = element.parentElement ? getComputedStyle(element.parentElement).display : 'block';
  if (element.tagName === 'LI' || element.tagName === 'TD' || element.tagName === 'TH') return 'inside';
  return FLEX_DISPLAYS.has(parentDisplay) ? 'inside' : 'after';
}

function textForBlock(
  element: HTMLElement,
  kind: TranslationBlockKind
): { text: string; protectedFragments: ProtectedFragment[] } {
  return textWithProtectedFragments(element, kind === 'generic' || kind === 'compact');
}

function isBadCandidate(element: HTMLElement, text: string, kind: TranslationBlockKind): boolean {
  const relaxed = isReadingSurface(element);
  if (!isMeaningfulBlockText(text, kind, relaxed)) return true;
  if (interactiveDescendantCount(element) > 2) return true;
  if (kind !== 'paragraph' && kind !== 'heading' && linkTextRatio(element, text) > 0.88) return true;
  const style = getComputedStyle(element);
  if (FLEX_DISPLAYS.has(style.display) && kind === 'generic') return true;
  return false;
}

export function collectTranslationBlocks(root: ParentNode = document.body): TranslationBlock[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = node.nodeValue ?? '';
      const parent = node.parentElement;
      if (!parent || !hasTranslatableText(value) || isExcluded(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const candidates = new Set<HTMLElement>();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent) continue;
    const block = nearestTranslationBlock(parent);
    if (!block || block.dataset.aitranState || block.dataset.aitranTranslated === 'true' || !isVisible(block)) continue;
    candidates.add(block);
  }

  const blocks: TranslationBlock[] = [];
  for (const element of candidates) {
    const kind = kindForElement(element);
    if (!kind) continue;
    const { text, protectedFragments } = textForBlock(element, kind);
    if (isBadCandidate(element, text, kind)) continue;
    const readingSurface = isReadingSurface(element);
    const normalizedKind = (kind === 'table-cell' && !readingSurface) ? 'compact' : kind;
    if (!isMeaningfulBlockText(text, normalizedKind, readingSurface)) continue;
    blocks.push({ element, text, kind: normalizedKind, placement: placementForElement(element, normalizedKind), protectedFragments });
  }
  return blocks;
}

export function createBatches(blocks: TranslationBlock[], maxItems = 20, maxCharacters = 6000): TranslationBlock[][] {
  const batches: TranslationBlock[][] = [];
  let batch: TranslationBlock[] = [];
  let characters = 0;

  for (const block of blocks) {
    if (batch.length && (batch.length >= maxItems || characters + block.text.length > maxCharacters)) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(block);
    characters += block.text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
