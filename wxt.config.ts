import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  manifest: (env) => ({
    name: 'aiTran',
    short_name: 'aiTran',
    description: 'Free bilingual webpage, text, selection, hover, input, and document translation.',
    version: '0.3.21',
    permissions: ['storage', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    ...(env.browser === 'firefox' ? {
      browser_specific_settings: {
        gecko: {
          id: 'aitran@wbangin.github.io',
          strict_min_version: '140.0',
          data_collection_permissions: {
            required: ['websiteContent', 'personalCommunications']
          }
        }
      }
    } : {}),
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
  })
});
