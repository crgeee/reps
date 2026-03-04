import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'web'],
    globals: false,
    environment: 'node',
    passWithNoTests: true,
  },
});
