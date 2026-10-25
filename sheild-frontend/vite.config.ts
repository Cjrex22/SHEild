import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'firebase-messaging-sw.js'],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ['firebase-messaging-sw.js'],
        navigateFallbackDenylist: [/firebase-messaging-sw\.js/],
        globIgnores: ['firebase-messaging-sw.js']
      },
      manifest: {
        name: 'SHEild - Digital Bodyguard',
        short_name: 'SHEild',
        description: 'Women Safety & Emergency Web App',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'sheild-pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'sheild-pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    cors: true
  }
});
