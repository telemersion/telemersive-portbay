import { defineConfig } from 'vitest/config'

// `*.integration.test.ts` files are excluded by default — they spawn the
// vendored `uv` binary and are only meaningful when bumping UltraGrid.
// Run them on demand with `npm run test:integration`.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/*.integration.test.ts']
  }
})
