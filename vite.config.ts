/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// True for a module inside one of these npm packages (or package scopes)
const inPackages = (...names: string[]) => (id: string) =>
  names.some(name => id.replace(/\\/g, '/').includes(`/node_modules/${name}/`));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Snapshots show dates and times as in Bangladesh, where the app is used; GitHub's CI runs in UTC.
    // Test workers start after this and inherit it.
    if (mode === 'test') process.env.TZ = 'Asia/Dhaka';
    // Tests must not pick up the developer's real key from .env
    const processKey = mode === 'test' ? '' : (env.GEMINI_API_KEY || env.VITE_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.API_KEY || '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
        },
      },
      plugins: [
        react(), 
        tailwindcss(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
          manifest: {
            name: 'Transcriver',
            short_name: 'Transcriver',
            description: 'AI powered fast and accurate transcription tool',
            theme_color: '#ffffff',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 50 * 1024 * 1024 // 50MB precache limit per file
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(processKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(processKey)
      },
      build: {
        rolldownOptions: {
          output: {
            // The same vendor chunks as before. Firestore Lite, the Gemini SDK and the Supabase SDK are
            // imported only when used, so their chunks still download only then.
            codeSplitting: {
              groups: [
                { name: 'vendor-react', test: inPackages('react', 'react-dom', 'scheduler') },
                { name: 'vendor-firebase', test: (id: string) => inPackages('firebase', '@firebase')(id) && !/[\\/]lite[\\/]/.test(id) },
                { name: 'vendor-genai', test: inPackages('@google/genai') },
                { name: 'vendor-ui', test: inPackages('framer-motion', 'motion-dom', 'motion-utils', 'lucide-react') },
                { name: 'vendor-supabase', test: inPackages('@supabase') },
                { name: 'vendor-i18n', test: inPackages('i18next', 'react-i18next') },
              ],
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(import.meta.dirname, '.'),
        }
      },
      test: {
        environment: 'jsdom',
        setupFiles: ['./setupTests.ts'],
        globals: true
      }
    };
});
