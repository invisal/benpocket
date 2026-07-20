import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { version } from './package.json';

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@screen-recorder': resolve('src/renderer/tools/screen-recorder')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@screen-recorder': resolve('src/renderer/tools/screen-recorder')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        '@screen-recorder': resolve('src/renderer/tools/screen-recorder')
      }
    },
    build: {
      rollupOptions: {
        // Only ever imported by export-worker.ts's import graph (a hidden,
        // nodeIntegration:true window -- see export-worker-window.ts) --
        // left external so they resolve via that window's real Node
        // `require`/native ESM-require at runtime instead of being bundled
        // for a browser environment, the same way the main-process build
        // already externalizes execa. Harmless for every other renderer
        // entry below, none of which import these.
        external: [
          'electron',
          'fs',
          'path',
          'stream',
          'node:fs',
          'node:path',
          'node:stream',
          'execa',
          'ffmpeg-static',
          'ffprobe-static'
        ],
        input: {
          index: resolve('src/renderer/index.html'),
          regionSelect: resolve('src/renderer/region-select.html'),
          recorderToolbar: resolve('src/renderer/recorder-toolbar.html'),
          sourcePickerOverlay: resolve('src/renderer/source-picker-overlay.html'),
          exportWorker: resolve('src/renderer/export-worker.html')
        }
      }
    },
    // Vite's dev-server dependency pre-bundler (esbuild) is separate from
    // the Rollup `build.rollupOptions.external` above -- it doesn't consult
    // that list, and by default tries to pre-bundle every bare import it
    // finds for the browser, including execa's ESM-only transitive deps
    // (unicorn-magic etc.), which esbuild can't resolve any better here than
    // tsx could earlier. Excluding them stops the optimizer from touching
    // them at all, matching how they're handled in the production build.
    optimizeDeps: {
      exclude: ['electron', 'execa', 'ffmpeg-static', 'ffprobe-static']
    },
    // The nested PixiJS render Worker (rendering-engine/render-worker.ts,
    // imported via a `?worker` suffix from render-worker-client.ts) pulls in
    // pixi.js, which internally code-splits (autoDetectRenderer dynamically
    // imports the WebGL/WebGPU backend) -- Vite's default worker format
    // ('iife') can't support that, so this worker output needs ES modules,
    // matching the `{ type: 'module' }` the Worker is already constructed
    // with.
    worker: {
      format: 'es'
    },
    define: {
      __APP_VERSION__: JSON.stringify(version)
    },
    plugins: [react(), tailwindcss()]
  }
});
