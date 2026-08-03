import { app } from 'electron';
import { resolve } from 'path';

export const DEEP_LINK_PROTOCOL = 'benpocket';

/**
 * Registers this app as the `benpocket://` protocol handler and wires up
 * both delivery paths Electron uses for an already-running app: `open-url` on
 * macOS, `second-instance` argv parsing on Windows/Linux. Provider-agnostic on
 * purpose (just hands the raw URL to `onUrl`) so a second OAuth provider later
 * doesn't need a second deep-link path -- see benpocket-backend PLAN.md §4's
 * "Provider growth" note.
 *
 * Must be called before `app.whenReady()`, alongside `app.requestSingleInstanceLock()`
 * in src/main/index.ts -- `open-url` can fire before the app is ready on macOS, and
 * `second-instance` needs to be registered before the second instance's launch is
 * forwarded here.
 */
export function registerDeepLinkHandler(onUrl: (url: string) => void): void {
  // In dev (unpackaged), the registered handler needs to point at the actual
  // entry script, not a bare Electron binary -- otherwise clicking the deep
  // link launches a fresh, argument-less Electron process.
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, process.execPath, [
        resolve(process.argv[1])
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
  }

  app.on('open-url', (event, url) => {
    event.preventDefault();
    onUrl(url);
  });

  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`));
    if (url) onUrl(url);
  });
}
