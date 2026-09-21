# Changelog

## 0.3.8 - 2026-09-21

- Fixed GitHub README fenced code blocks being collected and translated through nested syntax-highlight spans.
- Excluded source-code rows and common browser editor surfaces, including GitHub blob code, Monaco, CodeMirror, Ace, Prism, Shiki, and highlight.js containers.
- Protected inline `code`, `kbd`, `samp`, and `var` fragments with placeholders and restored their original text after surrounding prose translation.
- Added regression tests for README code fences, GitHub source rows, editor surfaces, and inline-code preservation.

## 0.3.7 - 2026-09-20

- Explicitly routed selection, hover, and input translation through the same provider selected for webpage translation.
- Google webpage translation now means Google selection translation; Microsoft follows Microsoft; custom APIs follow the exact same custom provider.
- Kept custom OpenAI-compatible prompts active for selection requests through the existing `selection` scene.
- Added provider-routing regression tests and displayed the followed provider in the selection control tooltip.

## 0.3.6 - 2026-09-20

- Added macOS-specific suggested shortcuts: `⌘⇧L` for page translation and `⌘⇧I` for focused-input translation.
- Kept Windows and Linux shortcuts as `Alt+A` and `Alt+I`.
- Made the popup read and display Chrome's actual assigned shortcuts, including user customizations.
- Displayed macOS shortcuts with native symbols and described hover translation as `⌥ Option` on macOS.
- Updated the settings page shortcut help according to the current operating system.

## 0.3.5 - 2026-09-20

- Increased popup text sizes across labels, selectors, actions, cards, hints, and footer controls.
- Switched the popup to a Chinese-first native system font stack using PingFang SC, Microsoft YaHei, and Noto Sans CJK SC fallbacks.
- Replaced synthetic intermediate weights with clearer standard font weights and improved muted-text contrast.
- Increased the popup width and control heights slightly to preserve spacing with the larger type.

## 0.3.4 - 2026-09-20

- Prevented the popup from crashing when a stale or restarting extension background returns a null page status.
- Added runtime validation and normalization for page-status messages.
- Replaced the misleading restricted-page message with an actionable background reload error.
- Added regression tests for null and malformed page-status responses.

## 0.3.3 - 2026-09-20

- Fixed “仅显示译文” still rendering the original and translation together.
- Applied bilingual/translation-only changes immediately to existing translations without retranslating the page.
- Preserved each element's original inline display value and `!important` priority when hiding and restoring source text.
- Correctly moves translations placed inside source blocks out before hiding the source, then restores their bilingual placement when switched back.
- Added display-mode DOM regression tests.

## 0.3.2 - 2026-09-18

- Fixed translated pages inside email/document iframes still showing “翻译网页” in the popup.
- Aggregated translation state across every frame in the active tab instead of accepting an arbitrary frame response.
- Kept the popup, floating edge button, keyboard shortcut, and context-menu toggle on one shared page state.
- Added live progress/state broadcasts and a multi-frame status regression test.

## 0.3.1 - 2026-09-18

- Reduced the webpage floating button from 38px to 30×32px.
- Docked the floating button directly against the right edge.
- Changed it to a translucent indigo/blue surface with a lighter shadow.
- Increased opacity slightly on hover while keeping the resting state unobtrusive.
- Used a left-rounded edge-tab shape instead of a detached rounded square.

## 0.3.0 - 2026-09-18

- Added OpenAI Chat Completions-compatible custom providers.
- Added configurable system, single-segment, subtitle, and multi-segment prompt templates.
- Added model, temperature, maximum batch-size, compatibility-batch, and independent-item settings.
- Added prompt variables for source language, target language, text, title, summary, terminology, and style guidance.
- Added %% compatibility batching with automatic per-item recovery when a model returns the wrong number of segments.
- Added prompt-aware cache revisions so changing a prompt does not reuse stale translations.
- Preserved the existing aiTran JSON batch protocol.

## 0.2.4 - 2026-09-18

- Unified Popup, settings, standalone tools, selection cards, and floating controls under an indigo/blue business theme.
- Removed pink primary buttons and status controls.
- Reduced Popup width, control height, spacing, card radius, and button density.
- Separated external translation tools from current-page features.
- Added clearer tool descriptions and compact setting indicators.
- Clarified that selection translation uses the currently selected translation provider, with local cache reuse rather than a local dictionary.

## 0.2.3 - 2026-09-18

- Fixed email bodies and embedded documents not being translated when rendered inside iframes.
- Enabled content scripts in all frames, including about:blank and srcdoc frames.
- Switched reading surfaces to a content-first policy: short greetings, email headers/footers, list items, and table-based email layouts are translated.
- Kept hard exclusions limited to scripts, hidden content, editable fields, and explicit interactive controls.
- Suppressed duplicate floating controls inside child frames.
- Added regression coverage for table-based HTML email content.

## 0.2.2 - 2026-09-18

- Fixed the v0.2.1 regression that filtered too much GitHub repository content.
- Restored translation for commit descriptions, repository summaries, sentence-like file-list cells, and sidebar descriptions.
- Added a compact in-cell translation mode so repository grids and tables remain aligned.
- Continued to skip filenames, paths, dates, navigation labels, buttons, and toolbars.
- Count translated blocks only when a visible translated result is rendered.

## 0.2.1 - 2026-09-18

- Reworked webpage block detection to focus on semantic reading content.
- Excluded navigation, toolbars, buttons, sidebars, application controls, repository file lists, and non-article tables.
- Added GitHub-oriented filtering for project names, file paths, filenames, and short UI labels.
- Prevented translation siblings from becoming unwanted Flex/Grid layout items.
- Replaced dense colored left borders with compact low-contrast translation cards.
- Added pending-state deduplication for dynamic pages.
- Added DOM regression tests for GitHub-like layouts and article tables.

## 0.2.0 - 2026-09-18

- Rebuilt the popup around quick translation controls and a feature grid.
- Added selection translation with an in-page result card.
- Added Alt-hover paragraph translation.
- Added input translation with Alt+I and editable-field context menus.
- Added an optional floating translate/restore button.
- Added a standalone long-text translator.
- Added local PDF text extraction and document translation.
- Added TXT, Markdown, HTML, SRT, and VTT translation and downloads.
- Added context menus for page, selection, input, and text translation.
- Added source/target language swapping.
- Added page-feature settings and a built-in privacy page.

## 0.1.0 - 2026-09-18

- Initial Chrome/Edge Manifest V3 MVP.
- Added bilingual page translation, Google Translate Free, Microsoft Translate Free, custom providers, settings, and local cache.
