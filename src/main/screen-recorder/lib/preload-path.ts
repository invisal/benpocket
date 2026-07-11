import { existsSync } from 'fs';
import { join } from 'path';

/** Match whichever preload bundle electron-vite emitted (`.mjs` in dev, `.js` in some builds). */
export function preloadScriptPath(): string {
  const dir = join(__dirname, '../preload');
  const mjs = join(dir, 'index.mjs');
  if (existsSync(mjs)) return mjs;
  return join(dir, 'index.js');
}
