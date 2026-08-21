import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

let app: ElectronApplication;
let userDataDir: string;

test.beforeEach(async () => {
  // The app persists its open tabs (zustand `persist`) into its userData
  // profile, so reusing the default profile would carry state between runs
  // (e.g. the previous test's opened tool tab). A fresh --user-data-dir per
  // test keeps runs isolated, same as always starting from a clean install.
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benpocket-e2e-'));

  // Requires a prior `npm run build` -- this launches the built main entry
  // point, same as `npm start` (electron-vite preview) does.
  app = await electron.launch({
    args: [path.resolve('out/main/index.js'), `--user-data-dir=${userDataDir}`]
  });
});

test.afterEach(async () => {
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('opens the File Explorer tool from the home screen', async () => {
  const window = await app.firstWindow();

  // The home screen search box is a reliable "we're on home" marker.
  await expect(window.getByPlaceholder('Search your tools')).toBeVisible();

  await window.getByRole('button', { name: /file explorer/i }).click();

  // Home's content is swapped out for the selected tool's, so the search
  // box going away is a decent proxy for "the click navigated somewhere".
  await expect(window.getByPlaceholder('Search your tools')).not.toBeVisible();
});
