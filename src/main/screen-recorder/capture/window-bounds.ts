import { spawn } from 'child_process';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * On-screen bounds of a named app's frontmost window, via System
 * Events/AppleScript (macOS only). Used to give a `desktopCapturer` window
 * source the same kind of `displayBounds` a screen source gets, so cursor
 * position/click tracking -- which just needs *some* pixel rect to
 * normalize against, see cursor-tracker.ts/click-tracker.ts -- works on a
 * window too (currently only wired up for the Simulator window; see
 * screen-source-provider.ts).
 *
 * Requires Automation permission for this app to control "System Events"
 * (a separate macOS TCC grant from the Accessibility permission
 * uiohook-napi needs for global input -- expect a one-time system prompt
 * the first time this runs). Snapshotted once at recording start, not
 * polled -- if the window is moved/resized mid-recording, tracking drifts
 * for the rest of that recording (same limitation a screen source would
 * have if its resolution changed mid-recording).
 */
export function getAppWindowBounds(processName: string): Promise<WindowBounds | null> {
  // System Events/AppleScript only exists on macOS.
  if (process.platform !== 'darwin') return Promise.resolve(null);

  return new Promise((resolve) => {
    const script = `tell application "System Events" to tell process "${processName}" to get {position, size} of front window`;
    const proc = spawn('osascript', ['-e', script]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on('error', (err) => {
      console.warn(`[window-bounds] failed to spawn osascript for "${processName}":`, err);
      resolve(null);
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        // Most likely cause: this app doesn't have Automation permission to
        // control "System Events" yet (System Settings > Privacy & Security
        // > Automation), or `processName` has no window open right now.
        console.warn(
          `[window-bounds] osascript exited ${code} for "${processName}": ${stderr.trim() || '(no stderr)'}`
        );
        resolve(null);
        return;
      }
      // osascript prints a flattened list for `{position, size}`, e.g.
      // "100, 200, 800, 600" for position {100, 200} and size {800, 600}.
      const nums = stdout
        .trim()
        .split(',')
        .map((s) => parseInt(s.trim(), 10));
      if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
        console.warn(
          `[window-bounds] unexpected osascript output for "${processName}": "${stdout.trim()}"`
        );
        resolve(null);
        return;
      }
      const [x, y, width, height] = nums;
      console.log(`[window-bounds] resolved "${processName}" window bounds:`, {
        x,
        y,
        width,
        height
      });
      resolve({ x, y, width, height });
    });
  });
}
