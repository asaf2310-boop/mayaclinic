import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const vercelHostHint = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
].filter(Boolean).join(' ')

const isDemoBuild =
  process.env.VITE_DEMO_MODE === 'true' ||
  vercelHostHint.includes('karinshinanit-demo') ||
  vercelHostHint.includes('mayaclinic-demo')

function getDemoBaseUrl() {
  if (process.env.VITE_DEMO_URL) {
    return process.env.VITE_DEMO_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
  }
  return 'https://karinshinanit-demo.vercel.app'
}

function demoBrandingPlugin() {
  return {
    name: 'demo-branding',
    transformIndexHtml(html) {
      if (!isDemoBuild) return html

      const demoTitle = 'מערכת דמו לקליניקה'
      const demoDescription = 'מערכת דמו לקביעת תורים וניהול קליניקה'
      const demoImage = `${getDemoBaseUrl()}/demo-icon.svg`

      return html
        .replace(/<title>.*?<\/title>/, `<title>${demoTitle}</title>`)
        .replace(
          /<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/,
          `<meta name="apple-mobile-web-app-title" content="${demoTitle}" />`
        )
        .replace(
          /<link rel="apple-touch-icon" href="[^"]*" \/>/,
          ''
        )
        .replace(
          '</head>',
          `    <link rel="icon" href="/demo-icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/demo-icon.svg" />
    <meta name="description" content="${demoDescription}" />
    <meta property="og:title" content="${demoTitle}" />
    <meta property="og:description" content="${demoDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${getDemoBaseUrl()}/" />
    <meta property="og:image" content="${demoImage}" />
    <meta property="og:image:alt" content="${demoTitle}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${demoTitle}" />
    <meta name="twitter:description" content="${demoDescription}" />
    <meta name="twitter:image" content="${demoImage}" />
  </head>`
        )
    },
    closeBundle() {
      if (!isDemoBuild) return

      const manifestPath = path.resolve('dist/manifest.json')
      const demoManifest = {
        name: 'מערכת דמו לקליניקה',
        short_name: 'דמו קליניקה',
        description: 'מערכת דמו לקביעת תורים וניהול קליניקה',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f3ee',
        theme_color: '#2eb88a',
        lang: 'he',
        dir: 'rtl',
        icons: [
          {
            src: '/demo-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      }

      fs.writeFileSync(manifestPath, `${JSON.stringify(demoManifest, null, 2)}\n`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    demoBrandingPlugin(),
  ]
});