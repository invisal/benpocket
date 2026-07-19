import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// Mirrors electron.vite.config.ts's renderer aliases -- kept in its own
// config (not derived from electron-vite's) since electron-vite's
// multi-target (main/preload/renderer) config shape isn't something
// vitest can consume directly.
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
      '@screen-recorder': resolve('src/renderer/tools/screen-recorder')
    }
  }
});
