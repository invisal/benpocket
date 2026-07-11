import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
        input: {
          index: resolve('src/renderer/index.html'),
          regionSelect: resolve('src/renderer/region-select.html')
        }
      }
    },
    plugins: [react(), tailwindcss()]
  }
});
