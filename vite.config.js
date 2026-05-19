import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const isDemoBuild = process.env.VITE_DEMO_MODE === 'true'

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

      const demoTitle = 'הקליניקה של קארין'
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
          '<link rel="apple-touch-icon" href="/demo-icon.svg" />'
        )
        .replace(
          '</head>',
          `    <meta name="description" content="${demoDescription}" />
    <meta property="og:title" content="${demoTitle}" />
    <meta property="og:description" content="${demoDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${demoImage}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${demoTitle}" />
    <meta name="twitter:description" content="${demoDescription}" />
  </head>`
        )
    },
    closeBundle() {
      if (!isDemoBuild) return

      const manifestPath = path.resolve('dist/manifest.json')
      const demoManifest = {
        name: 'הקליניקה של קארין - דמו',
        short_name: 'קארין דמו',
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
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    demoBrandingPlugin(),
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
  ]
});