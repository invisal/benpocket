import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

let app: ElectronApplication;
let userDataDir: string;
let workspaceDir: string;

test.beforeEach(async () => {
  // Same per-test isolation as home.spec.ts -- see its comment for why.
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benpocket-e2e-'));

  // A real folder on disk for the Workspace tool to browse -- it lists directories
  // via the real fileExplorer IPC, no mocking involved.
  workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benpocket-e2e-workspace-'));
  fs.writeFileSync(path.join(workspaceDir, 'notes.txt'), 'hello from e2e\n');
  fs.mkdirSync(path.join(workspaceDir, 'subfolder'));
  fs.writeFileSync(path.join(workspaceDir, 'subfolder', 'nested.md'), '# nested\n');

  // Requires a prior `npm run build`. BENPOCKET_E2E=1 turns on `window.devTools`
  // (see ToolProvider.ts) so the test can open the Workspace tab directly --
  // it's only reachable in the real UI via File Explorer's "Open Workspace"
  // context menu, which would make this test about File Explorer, not Workspace.
  app = await electron.launch({
    args: [path.resolve('out/main/index.js'), `--user-data-dir=${userDataDir}`],
    env: { ...process.env, BENPOCKET_E2E: '1' }
  });
});

test.afterEach(async () => {
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.rmSync(workspaceDir, { recursive: true, force: true });
});

test('opens a folder in the Workspace tool and previews a file', async () => {
  // Named `page` rather than `window` (unlike home.spec.ts) so `window` inside the
  // .evaluate() callbacks below unambiguously refers to the in-page DOM global,
  // both to TypeScript and to a reader -- shadowing it with the Page instance would
  // make `window.devTools` type-check against Playwright's `Page`, not the browser.
  const page = await app.firstWindow();

  await page.waitForFunction(() => typeof window.devTools !== 'undefined');
  await page.evaluate(
    (folderPath) => window.devTools!.openTab('workspace', { path: folderPath }),
    workspaceDir
  );

  await expect(page.getByText('notes.txt')).toBeVisible();
  await expect(page.getByText('subfolder')).toBeVisible();

  await page.getByText('notes.txt').click();
  await expect(page.getByText('hello from e2e')).toBeVisible();
});
