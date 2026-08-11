import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { version } from './package.json';

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@screen-recorder': resolve('src/renderer/tools/screen-recorder')
      }
    },
    plugins: [visualizer({ filename: 'stats-main.html', template: 'treemap', gzipSize: true })]
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@screen-recorder': resolve('src/renderer/tools/screen-recorder')
      }
    },
    plugins: [visualizer({ filename: 'stats-preload.html', template: 'treemap', gzipSize: true })]
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
        input: {
          index: resolve('src/renderer/index.html'),
          regionSelect: resolve('src/renderer/region-select.html'),
          recorderToolbar: resolve('src/renderer/recorder-toolbar.html'),
          recordingRegionFrame: resolve('src/renderer/recording-region-frame.html'),
          sourcePickerOverlay: resolve('src/renderer/source-picker-overlay.html')
        },
        output: {
          chunkFileNames: (chunk) => {
            const ids = [chunk.facadeModuleId, ...chunk.moduleIds].filter(
              (id): id is string => id !== null
            );
            const toolNames = new Set(
              ids
                .map((id) => id.match(/[\\/]tools[\\/]([^\\/]+)[\\/]/)?.[1])
                .filter((name): name is string => name !== undefined)
            );
            return toolNames.size === 1
              ? `assets/tool-${[...toolNames][0]}-[hash].js`
              : 'assets/[name]-[hash].js';
          }
        }
      }
    },
    // The export Worker (features/export/engine/export-worker.ts, imported
    // via a `?worker` suffix from the export coordinator) pulls in pixi.js, which
    // internally code-splits (autoDetectRenderer dynamically imports the
    // WebGL/WebGPU backend) -- Vite's default worker format ('iife') can't
    // support that, so this worker output needs ES modules, matching the
    // `{ type: 'module' }` the Worker is already constructed with.
    worker: {
      format: 'es'
    },
    // In `electron-vite dev`, this Worker's dev-mode module wrapper runs
    // with an opaque ("null") origin, so any `fetch()` it makes -- e.g.
    // `web-demuxer` loading its WASM file -- is treated as cross-origin even
    // against this same dev server, and gets blocked by CORS without this.
    server: {
      cors: true
    },
    optimizeDeps: {
      include: ['gif.js']
    },
    define: {
      __APP_VERSION__: JSON.stringify(version)
    },
    plugins: [
      react(),
      tailwindcss(),
      visualizer({ filename: 'stats-renderer.html', template: 'treemap', gzipSize: true })
    ]
  }
});
