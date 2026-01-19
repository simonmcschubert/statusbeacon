import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.{test,spec}.ts'],
    alias: {
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
