import { defineConfig } from 'vitest/config'

// Run ONLY the integration tests that the default config excludes.
// Invoked via `npm run test:integration`. See docs/upgrading-ultragrid.md.
export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**']
  }
})
