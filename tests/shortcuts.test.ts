import { describe, expect, it } from 'vitest';
import { createShortcutLabels, formatShortcut } from '../src/shared/shortcuts';

describe('platform shortcut labels', () => {
  it('uses macOS-native symbols for mac shortcuts', () => {
    expect(formatShortcut('Command+Shift+L', 'mac')).toBe('⌘⇧L');
    expect(formatShortcut('MacCtrl+Alt+I', 'mac')).toBe('⌃⌥I');
  });

  it('keeps Windows and Linux shortcut names readable', () => {
    expect(formatShortcut('Alt+I', 'win')).toBe('Alt+I');
    expect(formatShortcut('Command+Shift+L', 'linux')).toBe('Ctrl+Shift+L');
  });

  it('uses platform-specific defaults', () => {
    expect(createShortcutLabels('mac')).toEqual({
      toggleTranslation: '⌘⇧L',
      translateInput: '⌘⇧I',
      hoverModifier: '⌥ Option'
    });
    expect(createShortcutLabels('win')).toEqual({
      toggleTranslation: 'Alt+A',
      translateInput: 'Alt+I',
      hoverModifier: 'Alt'
    });
  });

  it('shows Chrome actual assignments and preserves an unassigned command', () => {
    expect(createShortcutLabels('mac', [
      { name: 'toggleTranslation', shortcut: 'Command+Shift+K' },
      { name: 'translateInput', shortcut: '' }
    ])).toEqual({
      toggleTranslation: '⌘⇧K',
      translateInput: '未设置',
      hoverModifier: '⌥ Option'
    });
  });
});
