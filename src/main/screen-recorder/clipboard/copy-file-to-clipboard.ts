import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFileReferenceToClipboardLinux } from './linux-clipboard-owner';

const execFileAsync = promisify(execFile);

function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

async function writeWindows(filePath: string): Promise<void> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$files = New-Object System.Collections.Specialized.StringCollection
$files.Add('${escapePowerShellString(filePath)}') | Out-Null
$data = New-Object System.Windows.Forms.DataObject
$data.SetFileDropList($files)
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function writeMac(filePath: string): Promise<void> {
  // No `{...}` list-wrapping around `POSIX file` -- that puts a `list` class
  // on the clipboard (an AppleScript list containing one file), which Finder
  // and other apps don't recognize as a pasteable file at all. The bare
  // form's clipboard class is `furl` (file URL), which is what actually
  // pastes as the real file -- verified directly with `osascript -e
  // 'clipboard info'` after each form.
  const script = `set the clipboard to POSIX file "${escapeAppleScriptString(filePath)}"`;
  await execFileAsync('osascript', ['-e', script]);
}

function writeToXclip(target: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // xclip's whole design is to fork into the background and stay alive
    // indefinitely, serving the clipboard selection to whoever pastes next --
    // it never exits on its own. Using execFile/exec and waiting for it to
    // close hangs forever once it does that fork, since the detached copy
    // keeps running (verified directly: the callback never fired even
    // seconds after the original process had already exited). `detached:
    // true` + `unref()` lets that background copy run on its own instead of
    // being waited on, and we resolve as soon as our end of stdin is
    // flushed, not when the process itself exits.
    const child = spawn('xclip', ['-selection', 'clipboard', '-t', target], {
      stdio: ['pipe', 'ignore', 'ignore'],
      detached: true
    });
    child.on('error', (err) => {
      // ENOENT here means the `xclip` binary itself is missing, not that the
      // copy failed -- surface that distinctly since the raw spawn error
      // ("spawn xclip ENOENT") is meaningless to a user with no reason to
      // know this app shells out to xclip for Linux file-clipboard support.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            'Copying to the clipboard requires the "xclip" utility, which is not installed. Install it with your package manager (e.g. "sudo apt install xclip") and try again.'
          )
        );
        return;
      }
      reject(err);
    });
    child.stdin.end(content, () => {
      child.unref();
      resolve();
    });
  });
}

async function writeLinux(filePath: string): Promise<void> {
  // Nautilus/Nemo/Caja only recognize the GNOME-proprietary
  // `x-special/gnome-copied-files` target; everything else (Telegram,
  // browsers, Slack, mail clients) reads the freedesktop.org-standard
  // `text/uri-list` instead -- and since a single xclip invocation can only
  // ever serve one target, no single xclip call satisfies both (confirmed
  // directly: switching between them just moved the same failure from one
  // audience to the other). benpocket-linux-clipboard-helper is a small
  // persistent CLIPBOARD selection owner that serves both simultaneously
  // from the same process -- see linux-clipboard-owner.ts and
  // clipboard_owner.cpp for the full mechanism.
  try {
    await writeFileReferenceToClipboardLinux(filePath);
    return;
  } catch (err) {
    // Most likely cause: a dev checkout that hasn't run `npm run
    // build:native:linux` yet. Fall back to the single-target xclip path so
    // copy-to-clipboard still works for *something* (text/uri-list is the
    // broader of the two -- non-GNOME apps plus Nautilus's own fallback
    // support for it) rather than hard-failing the whole feature.
    console.error(
      '[copy-file-to-clipboard] native clipboard helper unavailable, falling back to xclip (text/uri-list only):',
      err
    );
  }
  const uri = `file://${encodeURI(filePath)}`;
  await writeToXclip('text/uri-list', `${uri}\r\n`);
}

/** Writes a single exported file's path to the system clipboard as a file reference, so pasting elsewhere (Finder, Mail, Slack, ...) pastes the actual file. */
export async function copyFileToClipboard(filePath: string): Promise<void> {
  switch (process.platform) {
    case 'win32':
      return writeWindows(filePath);
    case 'darwin':
      return writeMac(filePath);
    default:
      return writeLinux(filePath);
  }
}
