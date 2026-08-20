import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * macOS counterpart of win-window-focus.ts -- same "shell out from this
 * Electron process, no compiled native helper involved" shape, just via
 * `osascript -l JavaScript` (JXA) instead of PowerShell, since that's the
 * scripting host that can reach Core Graphics/AppKit here. Deliberately kept
 * out of the macos-recorder Swift helper (native/macos-recorder) even though
 * that binary already has the window-bounds machinery this reuses the same
 * ideas from -- that helper's job is the capture/encode pipeline, and tying
 * a window-focus utility to it would mean every user has to rebuild/update
 * that binary for a change with nothing to do with recording itself. This
 * mirrors window-bounds.ts's existing `osascript` + System Events precedent
 * for the same reason.
 *
 * Resolves the window's owning PID via `CGWindowListCopyWindowInfo` (JXA's
 * ObjC bridge can call this directly, same Core Graphics API
 * queryWindowBoundsQuartz in main.swift uses) and activates that app via
 * `NSRunningApplication`. App-level, not a specific-window raise: there's no
 * public API to raise one particular window of a multi-window app by its
 * CGWindowID without going through Accessibility's private window-handle
 * bridge, which isn't worth the fragility for what's primarily meant to
 * un-occlude the window from this app's own picker UI. Won't un-minimize a
 * genuinely miniaturized window -- standard AppKit `activate()` behavior,
 * matching how clicking a Dock icon doesn't restore a minimized window on
 * macOS either.
 */
export function focusMacWindow(windowId: number): Promise<boolean> {
  if (process.platform !== 'darwin') return Promise.resolve(false);
  if (!Number.isInteger(windowId) || windowId <= 0) return Promise.resolve(false);

  const script = `
ObjC.import('CoreGraphics');
ObjC.import('AppKit');

function run() {
  // kCGWindowListOptionIncludingWindow -- CGWindow.h defines this as
  // (1 << 3); hardcoded rather than referenced as $.kCGWindowListOption...
  // since JXA's ObjC bridge only reliably exposes actual exported symbols,
  // not plain preprocessor/enum constants like this one.
  const info = ObjC.deepUnwrap($.CGWindowListCopyWindowInfo(8, ${windowId}));
  if (!info || info.length === 0) return JSON.stringify({ ok: false });

  const ownerPID = info[0]['kCGWindowOwnerPID'];
  if (ownerPID === undefined || ownerPID === null) return JSON.stringify({ ok: false });

  const app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(ownerPID);
  if (!app) return JSON.stringify({ ok: false });

  // NSApplicationActivateIgnoringOtherApps -- NSApplication.h defines this
  // as (1 << 1), same reasoning as the CG constant above.
  const ok = app.activateWithOptions(2);
  return JSON.stringify({ ok: Boolean(ok) });
}
`;

  return execFileAsync('osascript', ['-l', 'JavaScript', '-e', script])
    .then(({ stdout }) => {
      const trimmed = stdout.trim();
      if (!trimmed) return false;
      const payload = JSON.parse(trimmed) as Record<string, unknown>;
      return payload.ok === true;
    })
    .catch((err: unknown) => {
      console.warn(`[mac-window-focus] failed to focus window ${windowId}:`, err);
      return false;
    });
}
