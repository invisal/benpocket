import { spawn } from 'child_process';
import { accessSync, constants as fsConstants } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const HELPER_FILE_NAME = 'benpocket-linux-clipboard-helper';

/**
 * Same candidate-path convention as recording-helper.ts's helperCandidates()
 * -- a dev checkout's raw cmake build output, then the packaged app's
 * bundled resources (never the dev path once packaged, since spawn() can't
 * execve a path inside app.asar).
 */
function findHelperPath(): string | null {
  const archTag = `${process.platform}-${process.arch}`;
  const appRoot = app.getAppPath();
  const resourcesRoot = app.isPackaged ? process.resourcesPath : appRoot;
  const candidates = app.isPackaged
    ? [join(resourcesRoot, 'native', 'bin', archTag, HELPER_FILE_NAME)]
    : [
        join(appRoot, 'native', 'linux-recorder', 'build', HELPER_FILE_NAME),
        join(resourcesRoot, 'native', 'bin', archTag, HELPER_FILE_NAME)
      ];

  for (const candidate of candidates) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Try the next candidate location.
    }
  }
  return null;
}

/**
 * Registers a detached, long-lived process as the X11 CLIPBOARD selection
 * owner for `filePath`, serving both `text/uri-list` (the format most apps
 * -- browsers, chat apps, mail clients -- read) and
 * `x-special/gnome-copied-files` (the GNOME-proprietary format Nautilus and
 * its siblings require instead) from the same live process, since a single
 * clipboard owner can only exist at a time and each format needs different
 * content -- see clipboard_owner.cpp for the full reasoning and the
 * xclip-can't-do-this investigation notes.
 *
 * Resolves once the helper confirms it acquired the selection (typically a
 * few ms); the process then keeps running on its own, unref()'d, until
 * superseded by the next clipboard write or app quit.
 */
export function writeFileReferenceToClipboardLinux(filePath: string): Promise<void> {
  const helperPath = findHelperPath();
  if (!helperPath) {
    return Promise.reject(new Error('benpocket-linux-clipboard-helper is not built'));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(helperPath, [filePath], {
      stdio: ['ignore', 'pipe', 'ignore'],
      detached: true
    });

    let settled = false;
    let stdoutBuffer = '';

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      child.stdout.removeAllListeners('data');
      fn();
    };

    const timeoutId = setTimeout(() => {
      settle(() => {
        child.kill();
        reject(new Error('Timed out waiting for the clipboard helper to start.'));
      });
    }, 3000);

    child.on('error', (err) => settle(() => reject(err)));

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let payload: { event?: string; message?: string };
        try {
          payload = JSON.parse(line) as { event?: string; message?: string };
        } catch {
          continue;
        }
        if (payload.event === 'ready') {
          settle(() => {
            child.unref();
            resolve();
          });
          return;
        }
        if (payload.event === 'error') {
          settle(() => reject(new Error(payload.message ?? 'Linux clipboard helper failed')));
          return;
        }
      }
    });
  });
}
