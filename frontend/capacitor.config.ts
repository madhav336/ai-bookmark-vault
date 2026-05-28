import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aibookmarkvault.app',
  appName: 'AI Bookmark Vault',
  webDir: 'out',
  overrideUserAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  server: {
    url: 'https://ai-bookmark-vault.vercel.app',
    allowNavigation: [
      'ai-bookmark-vault.vercel.app',
      '*.clerk.accounts.dev',
      'accounts.google.com'
    ],
    cleartext: true
  }
};

export default config;
