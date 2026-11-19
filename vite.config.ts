import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'
import path from 'path'
import packageJson from './package.json'

let commitHash = 'unknown'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  commitHash = 'dev'
}

const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'masked-icon.svg',
        'badge-mono.png',
        'push-sw.js',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'MisDecimos - Trazabilidad Asegurada',
        short_name: 'MisDecimos',
        description: 'Custodia compartida y reparto de décimos de Lotería Nacional',
        theme_color: '#2E6146',
        background_color: '#F7F9F7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        related_applications: [
          {
            platform: 'webapp',
            url: 'https://misdecimos.dianrie.com/manifest.webmanifest'
          }
        ],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        importScripts: ['/push-sw.js']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(buildTime)
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase/supabase-js') || id.includes('@supabase/')) {
              return 'vendor-supabase'
            }
            if (id.includes('html5-qrcode') || id.includes('qrcode.react')) {
              return 'vendor-scanner'
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react'
            }
          }
        }
      }
    }
  }
})
