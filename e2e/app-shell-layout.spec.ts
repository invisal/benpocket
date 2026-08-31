import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

let app: ElectronApplication;
let userDataDir: string;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'benpocket-e2e-'));
  // Requires a prior `npm run build` -- see e2e/home.spec.ts.
  app = await electron.launch({
    args: [path.resolve('out/main/index.js'), `--user-data-dir=${userDataDir}`]
  });
});

test.afterEach(async () => {
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

/**
 * The shell's main column was `w-full` -- 100% of the `w-screen` root -- while
 * sitting next to the activity bar in the same flex row, so the row was
 * over-committed by the rail's width. Only the first layout shrank it away:
 * after any resize the column stayed that much too wide and the window clipped
 * its right edge, taking the titlebar close button, the active tool's
 * right-hand panel and the status bar's last segment with it.
 *
 * Measured on the right edges rather than by screenshot, because html/body
 * carry `overflow: hidden` -- nothing scrolls, so documentElement.scrollWidth
 * never reports the overflow.
 */
test('shell chrome stays inside the window across resizes', async () => {
  const page = await app.firstWindow();
  await expect(page.getByPlaceholder('Search your tools')).toBeVisible();

  for (const width of [1200, 900, 700, 520]) {
    await app.evaluate(({ BrowserWindow }, w) => {
      BrowserWindow.getAllWindows()[0].setSize(w, 800);
    }, width);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const viewport = document.documentElement.clientWidth;
            const overflowOf = (selector: string): number => {
              const el = document.querySelector(selector);
              if (!el) return Number.NaN;
              return Math.round(el.getBoundingClientRect().right) - viewport;
            };
            return Math.max(
              overflowOf('.titlebar-nodrag button:last-child'),
              overflowOf('#root > div > div:nth-child(2)')
            );
          }),
        { message: `right edge overflow at ${width}px` }
      )
      .toBeLessThanOrEqual(0);
  }
});
