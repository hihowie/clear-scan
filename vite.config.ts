import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const pagesBase = process.env.GITHUB_ACTIONS === 'true' ? '/clear-scan/' : '/'

export default defineConfig({
  base: pagesBase,
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@techstark/opencv-js/dist/opencv.js',
          dest: 'vendor',
          rename: { stripBase: true },
        },
      ],
    }),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png', 'manifest.*.webmanifest'],
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        globIgnores: ['**/vendor/opencv.js'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
})
