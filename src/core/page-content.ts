import { MAX_SUMMARY_CHARACTERS } from '../shared/summary';

export interface PageContent {
  title: string;
  text: string;
  truncated: boolean;
}

const EXCLUDED = 'script,style,noscript,template,svg,canvas,video,audio,iframe,input,textarea,select,button,nav,footer,aside,[role="navigation"],[role="menu"],[role="toolbar"],[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"],[data-aitran-ui],.aitran-translation';
const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'TD', 'TH', 'DT', 'DD', 'BLOCKQUOTE', 'PRE', 'BR']);

function isReadable(element: Element): boolean {
  if (element.matches(EXCLUDED)) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return !(style?.display === 'none' && !element.hasAttribute('data-aitran-original-display')) && style?.visibility !== 'hidden';
}

function readText(root: Element, limit: number): { text: string; truncated: boolean } {
  const pieces: string[] = [];
  let length = 0;
  let truncated = false;
  function visit(node: Node): void {
    if (length > limit) { truncated = true; return; }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      pieces.push(text.slice(0, limit + 1 - length));
      length += text.length;
      truncated ||= length > limit;
      return;
    }
    if (!(node instanceof Element)) return;
    // Original text hidden by aiTran's translation-only mode is still the source.
    if (!isReadable(node)) return;
    const block = BLOCK_TAGS.has(node.tagName);
    if (block) pieces.push('\n');
    for (const child of node.childNodes) visit(child);
    if (block) pieces.push('\n');
  }
  visit(root);
  const text = pieces.join('').split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
  return { text, truncated: truncated || text.length > limit };
}

export function collectPageContent(doc: Document = document): PageContent {
  const candidates = Array.from(doc.querySelectorAll('main,[role="main"],article,[role="article"],[itemprop="articleBody"]'));
  let content = { text: '', truncated: false };
  for (const candidate of candidates) {
    let ancestor: Element | null = candidate;
    while (ancestor && isReadable(ancestor)) ancestor = ancestor.parentElement;
    if (ancestor) continue;
    const candidateText = readText(candidate, MAX_SUMMARY_CHARACTERS);
    if (candidateText.text.length > content.text.length) content = candidateText;
  }
  if (content.text.length < 100 && doc.body) content = readText(doc.body, MAX_SUMMARY_CHARACTERS);
  return {
    title: doc.title.trim().slice(0, 500) || '当前页面',
    text: content.text.slice(0, MAX_SUMMARY_CHARACTERS),
    truncated: content.truncated
  };
}
