import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@screen-studio': resolve('src/renderer/tools/screen-studio')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@screen-studio': resolve('src/renderer/tools/screen-studio')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        '@screen-studio': resolve('src/renderer/tools/screen-studio')
      }
    },
    plugins: [react(), tailwindcss()]
  }
});
