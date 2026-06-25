import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        devOptions: {
          enabled: false,
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-storage',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.r2\.dev\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'media-assets',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                rangeRequests: true // Support for video streaming parts
              },
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'external-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 15, // 15 days
                }
              }
            }
          ]
        },
        manifest: {
          name: 'Maternidade Premium',
          short_name: 'Maternidade',
          description: 'Plataforma de cursos para maternidade',
          theme_color: '#0f0f0f',
          background_color: '#0f0f0f',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'https://picsum.photos/seed/maternity/192/192',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://picsum.photos/seed/maternity/512/512',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: true,
      chunkSizeWarningLimit: 1000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
