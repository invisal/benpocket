import { execFile } from 'child_process';
import { promisify } from 'util';

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
  const script = `set the clipboard to {POSIX file "${escapeAppleScriptString(filePath)}"}`;
  await execFileAsync('osascript', ['-e', script]);
}

function writeToXclip(target: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile('xclip', ['-selection', 'clipboard', '-t', target], (err) =>
      err ? reject(err) : resolve()
    );
    child.stdin?.end(content);
  });
}

async function writeLinux(filePath: string): Promise<void> {
  // Same single-target choice as file-explorer's nativeClipboard.ts -- xclip
  // only ever owns one target per invocation, and this is the one the
  // GNOME/Nautilus family (Nautilus, Nemo, Caja) actually reads as a file.
  await writeToXclip('x-special/gnome-copied-files', `copy\nfile://${filePath}`);
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
