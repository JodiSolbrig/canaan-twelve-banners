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
    // A sample large enough to separate a two-point tuning change runs well past
    // vitest's 5s default; BALANCE_GAMES=2400 takes about five.
    testTimeout: 600_000,
  },
});
