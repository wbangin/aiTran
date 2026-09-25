# Changelog

## 0.3.21 - 2026-09-25

- Added a categorized regression matrix for articles, documentation, cards, navigation, forms, code, hidden content, disclosure controls, iframe boundaries, web components and long text.
- Translate text in accessible open Shadow DOM trees, including nested and dynamically added components; count, restyle, switch display mode and restore their translations with the rest of the page.
- Preserve clickable disclosure summaries and fieldset legends, skip closed disclosure contents and inert/hidden regions, and allow semantic paragraphs up to 6,000 characters while keeping generic layout containers bounded.
- Added lifecycle checks for batches, dynamic updates, provider retries, inline code protection and original-page restoration; rebuilt Chrome and Firefox packages.

## 0.3.20 - 2026-09-25

- Translate short navigation and interface labels on the Chrome Web Store developer dashboard, which were previously excluded while longer page text could still be translated.
- Keep dashboard links and buttons functional in bilingual and translation-only modes; leave inputs, editable content and ordinary webpage control filtering untouched.
- Add focused collection and interaction regressions and rebuild Chrome/Firefox releases.

## 0.3.19 - 2026-09-25

- Remove redundant tabs/activeTab permissions and duplicate host declarations; retain storage, contextMenus and all-site access for webpage tools and custom API endpoints.
- Require HTTPS for remote/LAN custom APIs, allow HTTP only on loopback, reject URL-embedded credentials and block request redirects.
- Expand privacy disclosures for opt-in automatic translation, built-in fallback, local API keys, third-party processing and limited use; add matching store submission materials.
- Add URL, request, settings and release regression checks; release packaging does not read browser settings.

## 0.3.18 - 2026-09-25

- Unified extension/action icons, page favicons, popup/settings/standalone headers and summary branding around the floating entry's AiT monogram and purple-blue circle.
- Converted the monogram to shared vector paths, preserving the 30px floating entry, configurable background transparency and live preview; retained distinct functional action icons.
- Added reproducible SVG/PNG icon generation and brand asset regressions; rebuilt Chrome/Firefox release artifacts.

## 0.3.17 - 2026-09-25

- Added a live, actual-size floating-ball preview beside the transparency slider, using the same AiT artwork and styles as the page entry.
- Added light/dark checkerboard backgrounds for evaluating transparency; slider changes update only the preview until settings are saved.
- Kept the preview visible with an explicit disabled caption when the page entry is off, and added preview interaction regressions.
- Rebuilt Chrome/Firefox installation directories and release archives.

## 0.3.16 - 2026-09-25

- Reduced the AiT floating entry from 38px to 30px with a smaller monogram and softer shadow; retained an expanded touch hit area without enlarging the visible ball.
- Added a global floating-ball background transparency slider (0–80%, default 40%) under page enhancements, with live percentage feedback and synchronization to open pages after saving.
- Kept the logo and action toolbar readable; hover, keyboard focus and expansion restore the solid ball color.
- Added legacy-default, value-validation, persistence, settings UI and toolbar-refresh regression tests; rebuilt Chrome/Firefox artifacts.

## 0.3.15 - 2026-09-25

- Treat flex/grid containers and interactive cards as translation boundaries; translate safe text leaves instead of adding a competing layout column.
- Preserve short card titles and inline emphasis, avoid overlapping ancestor translations and re-collection, and keep styled action links out of translation blocks.
- Use compact translations for sidebar/card text and remove the misleading inside-placement flex-basis rule.
- Add workflow-card regressions for flex/grid layouts, bilingual/translation-only switching, button interaction and original-page restoration; rebuild Chrome/Firefox installation artifacts.

## 0.3.14 - 2026-09-24

- Applied approved popup grouping: translation action and display mode beside the logo, language/provider settings in the same region, then summary, page features, and standalone tools.
- Redesigned summary panel with compact header, collapsed configuration after generation, opening-section emphasis, and result-level copy/regenerate actions; preserved privacy notices and error/retry behavior.
- Replaced the two floating entries with one AiT monogram and a compact icon-only toolbar, including accessible labels, hover/focus hints, display-mode switching, outside/Escape dismissal and action error handling.
- Added interaction regressions and rebuilt versioned Chrome/Firefox artifacts.

## 0.3.13 - 2026-09-24

- Moved the compact page-translation action beside the popup logo and the AI summary entry immediately below the header; removed the free-edition badge.
- Moved page shortcut hints into the button tooltip and hid unassigned input shortcut badges; translation progress and restore behavior remain available.
- Removed page title/character-count previews from the summary panel; retained provider/language controls, privacy and truncation notices, and summary results. Copy is shown only after a result exists.
- Added popup interaction and compact summary-panel regression tests; rebuilt Chrome/Firefox release artifacts.
- Improved popup action and status contrast in dark mode.

## 0.3.12 - 2026-09-24

- Removed local Codex providers, Native Messaging/HTTP bridge protocols, setup UI, helper installers and nativeMessaging permission. Page summaries now use custom OpenAI-compatible APIs only.
- Added migration that removes retired provider settings without altering retained API credentials/prompts, and disables automatic translation/fallback if the selected provider was removed.
- Release packages now contain browser extensions only. Previously installed helpers and account data are not uninstalled or deleted.
- Documented research on ChatGPT browser-extension integration and the limits of public cross-extension APIs.

## 0.3.11 - 2026-09-24

- Added versioned release artifacts: Chrome upload ZIP, unsigned Firefox ZIP, standalone native-helper ZIP, unpacked test directories, checksums and installation instructions.
- Added double-click macOS helper installation/uninstallation entries and a Linux shell entry; no repository checkout or npm dependencies are needed by helper users.
- Added packaging validation and clean extraction/install smoke tests; preserved existing API and legacy bridge behavior.
- Removed unresolved merge markers from LICENSE while retaining both copyright notices and the MIT terms.

## 0.3.10 - 2026-09-23

- Added on-demand local Codex via browser Native Messaging, with no HTTP port or pairing key required.
- Added a one-time macOS/Linux helper installer and recoverable uninstaller for Chrome and Firefox, scoped to explicit extension IDs.
- Added quota-free helper/login checks, bounded serial tasks, disconnect cancellation, and automatic idle shutdown. Existing API services and legacy HTTP bridge settings remain supported.

## 0.3.9 - 2026-09-23

- Synchronized extension and displayed versions, and recorded the per-change version bump requirement in project instructions.
- Automatically completes OpenAI-compatible base URLs with `/chat/completions` in settings, translation tests, translation requests and page summaries, preserving existing endpoints and query parameters.
- Added a local Codex provider for translation and summaries, using the official CLI with ChatGPT authentication instead of extracting credentials.
- Added a loopback-only, paired local bridge with serialized jobs, bounded polling/cancellation, restricted CLI capabilities and setup instructions.
- Added an in-page AI summary panel with provider and output-language selection, copy, regeneration, and retry.
- Added summary entry points in the popup, page-edge controls, and page context menu.
- Extracts loaded article content, excludes editable fields and aiTran UI/translations, and explicitly reports long-page truncation.
- Uses enabled OpenAI-compatible custom services with a dedicated summary prompt; summary results stay in the current page.

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
