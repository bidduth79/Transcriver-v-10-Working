import { defineConfig } from 'vitest/config';

// Browser tests against the production build: `npm run e2e` (builds first). Not part of `npm test`.
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    environment: 'node',
    globalSetup: ['e2e/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 180000,
    hookTimeout: 90000,
  },
});
