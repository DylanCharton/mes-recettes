import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_URL = 'http://localhost:3000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA (spec § 20) : installation, cible de partage Android, coque et recettes lues hors ligne.
    VitePWA({
      registerType: 'autoUpdate',
      // Script externe /registerSW.js : compatible avec la CSP (script-src 'self').
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Mes recettes',
        short_name: 'Recettes',
        description: 'Ma bibliothèque de recettes personnelle',
        lang: 'fr',
        start_url: '/recipes',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#c2410c',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Partager depuis Jow → Mes recettes → /share?url=…&text=…&title=… (spec § 20.2).
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [
          { name: 'Importer une recette', short_name: 'Importer', url: '/import' },
          { name: 'Nouvelle recette', short_name: 'Nouvelle', url: '/recipes/new' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/images\//],
        runtimeCaching: [
          {
            // Images : noms uniques et immuables → cache d'abord.
            urlPattern: ({ url }) => url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 300 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Fiches déjà ouvertes : lisibles sans réseau (cuisine, cave, magasin).
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /^\/api\/recipes\/\d+$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'recipes',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': API_URL,
      '/images': API_URL,
    },
  },
});
