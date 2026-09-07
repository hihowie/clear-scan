import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/support/setup.ts'],
    include: ['tests/{unit,integration}/**/*.test.{ts,tsx}'],
    css: true,
  },
})
