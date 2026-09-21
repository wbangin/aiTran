import { browser } from 'wxt/browser';

export interface CommandShortcut {
  name?: string;
  shortcut?: string;
}

export interface ShortcutLabels {
  toggleTranslation: string;
  translateInput: string;
  hoverModifier: string;
}

const DEFAULT_SHORTCUTS = {
  mac: {
    toggleTranslation: 'Command+Shift+L',
    translateInput: 'Command+Shift+I'
  },
  other: {
    toggleTranslation: 'Alt+A',
    translateInput: 'Alt+I'
  }
} as const;

function formatMacShortcut(shortcut: string): string {
  return shortcut
    .replace(/MacCtrl/gi, '⌃')
    .replace(/Command/gi, '⌘')
    .replace(/Ctrl/gi, '⌃')
    .replace(/Option|Alt/gi, '⌥')
    .replace(/Shift/gi, '⇧')
    .replace(/\+/g, '');
}

export function formatShortcut(shortcut: string, os: string): string {
  if (!shortcut) return '未设置';
  if (os === 'mac') return formatMacShortcut(shortcut);
  return shortcut.replace(/MacCtrl/gi, 'Ctrl').replace(/Command/gi, 'Ctrl');
}

function assignedShortcut(
  commands: CommandShortcut[],
  name: keyof Pick<ShortcutLabels, 'toggleTranslation' | 'translateInput'>,
  fallback: string,
  os: string
): string {
  const command = commands.find((item) => item.name === name);
  if (!command) return formatShortcut(fallback, os);
  return formatShortcut(command.shortcut ?? '', os);
}

export function createShortcutLabels(os: string, commands: CommandShortcut[] = []): ShortcutLabels {
  const defaults = os === 'mac' ? DEFAULT_SHORTCUTS.mac : DEFAULT_SHORTCUTS.other;
  return {
    toggleTranslation: assignedShortcut(commands, 'toggleTranslation', defaults.toggleTranslation, os),
    translateInput: assignedShortcut(commands, 'translateInput', defaults.translateInput, os),
    hoverModifier: os === 'mac' ? '⌥ Option' : 'Alt'
  };
}

export async function loadShortcutLabels(): Promise<ShortcutLabels> {
  try {
    const [platform, commands] = await Promise.all([
      browser.runtime.getPlatformInfo(),
      browser.commands.getAll()
    ]);
    return createShortcutLabels(platform.os, commands);
  } catch {
    const os = /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'mac' : 'other';
    return createShortcutLabels(os);
  }
}
