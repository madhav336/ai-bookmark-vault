import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aibookmarkvault.app',
  appName: 'AI Bookmark Vault',
  webDir: 'out',
  server: {
    // Replace this with your production hosted URL (e.g. https://your-app.vercel.app)
    // For local dev server testing on the Android Emulator, use http://10.0.2.2:3000
    url: 'http://10.0.2.2:3000',
    cleartext: true
  }
};

export default config;
