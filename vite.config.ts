/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { readAppConfig } from './vite/app-config.ts'
import { qaninjaHtml } from './vite/qaninja-html.ts'

export default defineConfig(({ mode }) => {
  // The Render dashboard's names (API_BASE_URL, …), not VITE_*: only these validated public values reach the bundle.
  // Variables already in the environment win over .env.local, which the browser tests rely on.
  const config = readAppConfig(loadEnv(mode, import.meta.dirname, ''))
  return {
    plugins: [
      // One bundle: five small routes, and a tab left open across a deploy never asks for a chunk that was replaced.
      tanstackRouter({ target: 'react', autoCodeSplitting: false }),
      react(),
      qaninjaHtml(config),
    ],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    define: { __APP_CONFIG__: JSON.stringify(config) },
    // The API's CORS list and the extension's Clerk sync expect exactly http://localhost:5173.
    server: { host: 'localhost', port: 5173, strictPort: true },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'vite/**/*.test.ts'],
    },
  }
})
