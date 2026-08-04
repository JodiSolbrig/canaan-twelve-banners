/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * The balance harness runs on its own config so `npm test` stays a fast, quiet
 * pass/fail check and the report only appears when asked for (`npm run balance`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/balance.test.ts'],
  },
});
