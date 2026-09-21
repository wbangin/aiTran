import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MULTI_PROMPT,
  DEFAULT_SINGLE_PROMPT,
  DEFAULT_SUBTITLE_PROMPT,
  normalizeCustomProviderConfig,
  promptForScene,
  renderPromptTemplate
} from '../src/shared/prompts';
import { parseOpenAIContent, splitMultiTranslation } from '../src/providers/custom';

describe('AI prompt templates', () => {
  const provider = normalizeCustomProviderConfig({
    id: 'openai', name: 'OpenAI', url: 'https://api.example.com/v1/chat/completions', apiKey: '', enabled: true,
    protocol: 'openai-compatible', model: 'gpt-test'
  });

  it('selects single, subtitle, and multi prompts by scene and item count', () => {
    expect(promptForScene(provider, 'selection', 1)).toBe(DEFAULT_SINGLE_PROMPT);
    expect(promptForScene(provider, 'subtitle', 1)).toBe(DEFAULT_SUBTITLE_PROMPT);
    expect(promptForScene(provider, 'page', 3)).toBe(DEFAULT_MULTI_PROMPT);
  });

  it('renders translation variables and optional title context', () => {
    const rendered = renderPromptTemplate('{{from}} -> {{to}}\n{{text}}{{title_prompt}}', {
      text: 'Hello', sourceLanguage: 'en', targetLanguage: 'zh-CN', scene: 'page', context: { title: 'Example' }
    });
    expect(rendered).toContain('English -> Simplified Chinese');
    expect(rendered).toContain('Hello');
    expect(rendered).toContain('Document title: “Example”');
  });

  it('parses OpenAI chat completion content', () => {
    expect(parseOpenAIContent({ choices: [{ message: { content: '  你好  ' } }] })).toBe('你好');
  });

  it('splits multi-segment output using the compatibility separator', () => {
    expect(splitMultiTranslation('第一段\n\n%%\n\n第二段', 2)).toEqual(['第一段', '第二段']);
  });

  it('rejects a mismatched number of translated segments', () => {
    expect(() => splitMultiTranslation('只有一段', 2)).toThrow(/预期 2 段/);
  });
});
