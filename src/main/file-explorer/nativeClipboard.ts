import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type ClipboardMode = 'copy' | 'cut';
export type ClipboardFiles = { paths: string[]; mode: ClipboardMode };

function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

async function writeWindows(paths: string[], mode: ClipboardMode): Promise<void> {
  const fileArgs = paths.map((p) => `'${escapePowerShellString(p)}'`).join(',');
  // Preferred DropEffect is a 4-byte little-endian DWORD; 2 = move (cut), 5 = copy.
  // Writing it alongside the file drop list is what makes Explorer dim the icons
  // and perform a real move when the user pastes elsewhere.
  const dropEffect = mode === 'cut' ? 2 : 5;
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$files = New-Object System.Collections.Specialized.StringCollection
@(${fileArgs}) | ForEach-Object { $files.Add($_) | Out-Null }
$data = New-Object System.Windows.Forms.DataObject
$data.SetFileDropList($files)
$dropEffectBytes = [BitConverter]::GetBytes(${dropEffect})
$stream = New-Object System.IO.MemoryStream(,$dropEffectBytes)
$data.SetData("Preferred DropEffect", $stream)
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

async function readWindows(): Promise<ClipboardFiles | null> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$files = [System.Windows.Forms.Clipboard]::GetFileDropList()
if ($files.Count -eq 0) { exit }
$mode = "copy"
if ([System.Windows.Forms.Clipboard]::ContainsData("Preferred DropEffect")) {
  $stream = [System.Windows.Forms.Clipboard]::GetData("Preferred DropEffect")
  $bytes = New-Object byte[] 4
  $stream.Read($bytes, 0, 4) | Out-Null
  $effect = [BitConverter]::ToInt32($bytes, 0)
  if ($effect -band 2) { $mode = "cut" }
}
$result = @{ paths = @($files); mode = $mode }
$result | ConvertTo-Json -Compress
`;
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script
  ]);
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const parsed = JSON.parse(trimmed) as { paths: string | string[]; mode: ClipboardMode };
  const paths = Array.isArray(parsed.paths) ? parsed.paths : [parsed.paths];
  return { paths, mode: parsed.mode };
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function writeMac(paths: string[]): Promise<void> {
  // Finder has no public "Cut" pasteboard API, so mac always writes as a copy;
  // the caller-supplied mode is intentionally ignored here.
  const fileList = paths.map((p) => `POSIX file "${escapeAppleScriptString(p)}"`).join(', ');
  const script = `set the clipboard to {${fileList}}`;
  await execFileAsync('osascript', ['-e', script]);
}

async function readMac(): Promise<ClipboardFiles | null> {
  const script = `
set out to {}
try
  set theClipboard to (the clipboard as list)
  repeat with anItem in theClipboard
    try
      set out to out & (POSIX path of anItem)
    end try
  end repeat
end try
set AppleScript's text item delimiters to linefeed
return out as text
`;
  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  const paths = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (paths.length === 0) return null;
  return { paths, mode: 'copy' };
}

async function writeLinux(paths: string[], mode: ClipboardMode): Promise<void> {
  const uriList = paths.map((p) => `file://${p}`).join('\n');
  // xclip only ever owns one clipboard target per invocation -- a second call
  // would just replace the first as clipboard owner, not add a target -- so we
  // write only "x-special/gnome-copied-files" (understood by the GNOME/Nautilus
  // family: Nautilus, Nemo, Caja) since it's the only single target that also
  // carries the cut-vs-copy mode. File managers that only understand
  // text/uri-list won't see this as a file paste; that's an accepted gap.
  await writeToXclip('x-special/gnome-copied-files', `${mode}\n${uriList}`);
}

function writeToXclip(target: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile('xclip', ['-selection', 'clipboard', '-t', target], (err) =>
      err ? reject(err) : resolve()
    );
    child.stdin?.end(content);
  });
}

async function readLinux(): Promise<ClipboardFiles | null> {
  let targets: string;
  try {
    const { stdout } = await execFileAsync('xclip', [
      '-selection',
      'clipboard',
      '-o',
      '-t',
      'TARGETS'
    ]);
    targets = stdout;
  } catch {
    return null;
  }

  const availableTargets = targets.split('\n').map((t) => t.trim());

  if (availableTargets.includes('x-special/gnome-copied-files')) {
    const { stdout } = await execFileAsync('xclip', [
      '-selection',
      'clipboard',
      '-o',
      '-t',
      'x-special/gnome-copied-files'
    ]);
    const lines = stdout.split('\n').filter(Boolean);
    const mode: ClipboardMode = lines[0]?.trim() === 'cut' ? 'cut' : 'copy';
    const paths = lines
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((uri) => decodeURIComponent(uri.replace(/^file:\/\//, '')));
    if (paths.length === 0) return null;
    return { paths, mode };
  }

  if (availableTargets.includes('text/uri-list')) {
    const { stdout } = await execFileAsync('xclip', [
      '-selection',
      'clipboard',
      '-o',
      '-t',
      'text/uri-list'
    ]);
    const paths = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((uri) => decodeURIComponent(uri.replace(/^file:\/\//, '')));
    if (paths.length === 0) return null;
    return { paths, mode: 'copy' };
  }

  return null;
}

export async function writeFilesToClipboard(paths: string[], mode: ClipboardMode): Promise<void> {
  try {
    switch (process.platform) {
      case 'win32':
        return await writeWindows(paths, mode);
      case 'darwin':
        return await writeMac(paths);
      default:
        return await writeLinux(paths, mode);
    }
  } catch {
    // Native clipboard tooling (PowerShell/osascript/xclip) unavailable --
    // fail silently rather than crash the file operation flow.
  }
}

export async function readFilesFromClipboard(): Promise<ClipboardFiles | null> {
  try {
    switch (process.platform) {
      case 'win32':
        return await readWindows();
      case 'darwin':
        return await readMac();
      default:
        return await readLinux();
    }
  } catch {
    return null;
  }
}
