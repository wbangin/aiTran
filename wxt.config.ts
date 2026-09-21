import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  manifest: {
    name: 'aiTran',
    short_name: 'aiTran',
    description: 'Free bilingual webpage, text, selection, hover, input, and document translation.',
    version: '0.3.8',
    permissions: ['storage', 'activeTab', 'tabs', 'contextMenus'],
    host_permissions: [
      '<all_urls>',
      'https://translate.googleapis.com/*',
      'https://edge.microsoft.com/*'
    ],
    commands: {
      toggleTranslation: {
        suggested_key: { default: 'Alt+A', mac: 'Command+Shift+L' },
        description: 'Translate or restore the current page'
      },
      translateInput: {
        suggested_key: { default: 'Alt+I', mac: 'Command+Shift+I' },
        description: 'Translate the focused input field'
      }
    },
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png'
    },
    action: {
      default_title: 'aiTran',
      default_icon: {
        16: 'icons/16.png',
        32: 'icons/32.png',
        48: 'icons/48.png',
        128: 'icons/128.png'
      }
    }
  }
});
