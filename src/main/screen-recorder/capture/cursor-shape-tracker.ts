import type { WebContents } from 'electron';
import { spawn, type ChildProcessByStdio } from 'child_process';
import type { Readable } from 'stream';
import { IpcChannels } from '@shared/ipc-channels';
import { findMacRecorderHelperPath } from './native/recording-helper';
import { spawnWin32CursorShapeStream } from './native/win-cursor-shape';

type ShapeStreamChild = ChildProcessByStdio<null, Readable, null>;

/**
 * Streams the OS's own real cursor shape during a recording -- specifically,
 * whenever it's showing a horizontal or vertical resize cursor -- and
 * forwards each sighting to the renderer for `resolveCursorGesture`
 * (@shared/cursor-path). This is the only reliable signal for "the user is
 * dragging an internal resize handle" (a split-view divider, a panel
 * splitter) inside whatever's being recorded: unlike `WindowBoundsPoller`,
 * which only sees a recorded window's own *outer* OS rect, an internal
 * splitter drag never changes that rect at all, so there's nothing for the
 * bounds poller to observe there -- only the OS's own cursor shape reflects
 * it, since the OS itself decided to show a resize cursor because the
 * pointer is over a resize handle.
 *
 * A single persistent process is spawned once per recording (not re-spawned
 * per poll, unlike the 500ms window-bounds queries) -- see
 * native/macos-recorder/main.swift's `cursor-shape-stream` mode and
 * win-cursor-shape.ts's PowerShell loop for why: a poll fast enough to catch
 * a brief resize drag is far too fast to tolerate a fresh process spawn per
 * tick. Each only emits a line while the cursor is actually showing a resize
 * shape -- "resize has stopped" is inferred on the receiving end from the
 * *absence* of further samples (see `RESIZE_ACTIVE_WINDOW_MS`,
 * @shared/cursor-path.ts), so there's nothing useful to emit the rest of the
 * time.
 *
 * No diagonal detection either way -- macOS has no public diagonal system
 * cursor, and Windows' `IDC_SIZENWSE`/`IDC_SIZENESW` aren't checked here for
 * the same reason `WindowBoundsPoller` already covers that case (an actual
 * whole-window corner drag changes the window's own bounds, which that
 * poller does see).
 */
export class CursorShapeTracker {
  private child: ShapeStreamChild | null = null;

  start(webContents: WebContents, startedAt: number): void {
    this.stop();

    const child = process.platform === 'darwin' ? this.spawnMac() : spawnWin32CursorShapeStream();
    if (!child) return;

    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      // Bails if a newer start()/stop() has already moved on from this
      // child -- e.g. `stop()` sent SIGTERM but the dying process still had
      // stdout in flight when a new recording's start() spawned a
      // replacement; without this, a line from the *old* process would
      // still reach this same listener and get sent using the *new*
      // recording's `webContents`/`startedAt`, injecting a garbage-timestamp
      // sample into the new recording's resizePath.
      if (this.child !== child) return;
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (payload.event !== 'cursor-shape') continue;
        if (webContents.isDestroyed()) {
          this.stop();
          return;
        }
        webContents.send(IpcChannels.CursorShapeSample, {
          atMs: Date.now() - startedAt,
          kind: payload.kind
        });
      }
    });
    child.once('error', () => {
      if (this.child === child) this.child = null;
    });
    child.once('exit', () => {
      if (this.child === child) this.child = null;
    });
    this.child = child;
  }

  private spawnMac(): ShapeStreamChild | null {
    const helperPath = findMacRecorderHelperPath();
    if (!helperPath) return null;
    return spawn(helperPath, [JSON.stringify({ mode: 'cursor-shape-stream' })], {
      stdio: ['ignore', 'pipe', 'ignore']
    }) as ShapeStreamChild;
  }

  stop(): void {
    if (this.child && !this.child.killed) this.child.kill();
    this.child = null;
  }
}

export const cursorShapeTracker = new CursorShapeTracker();
