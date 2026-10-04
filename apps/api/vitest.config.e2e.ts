import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    fileParallelism: false,
    maxWorkers: 1,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
