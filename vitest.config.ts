import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // The real `server-only` throws outside a Server Component bundle; stub it
      // so server-only modules can be unit tested under the node environment.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts', 'app/**/*.test.ts'],
    coverage: {
      // Reported via `npm run test:coverage` (docs/QA-CHECKLIST.md P3-05).
      provider: 'v8',
      reporter: ['text', 'html'],
      // Only the tested source layers count toward the number -- exclude tests,
      // the eval harness (opt-in, real API), pure type/config modules, and the
      // presentational React tree (exercised by Playwright, not unit tests).
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/**/*.test.ts',
        'lib/source-watcher/eval/**',
        'lib/source-watcher/fixtures/**',
        'lib/types/**',
        'lib/**/config.ts',
      ],
      // A floor, not a target -- set just under the current numbers so a
      // regression trips CI while leaving headroom to raise as the untested
      // presentational/IO edges (email, push, supabase factories) get covered.
      thresholds: {
        statements: 45,
        branches: 42,
        functions: 43,
        lines: 45,
      },
    },
  },
});
