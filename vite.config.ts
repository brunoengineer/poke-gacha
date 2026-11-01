import { defineConfig } from 'vitest/config';

// `base: './'` makes the build work under any GitHub Pages path (e.g. /poke-gacha/).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['src/**/*.test.ts'], setupFiles: ['src/test/setup.ts'] },
});
