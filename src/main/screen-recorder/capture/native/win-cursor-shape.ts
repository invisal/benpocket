import { spawn, type ChildProcessByStdio } from 'child_process';
import type { Readable } from 'stream';

/**
 * Spawns a persistent PowerShell loop that polls the real Windows system
 * cursor via `GetCursorInfo`, comparing its handle against the two built-in
 * resize cursors (`IDC_SIZEWE` = 32644, `IDC_SIZENS` = 32645), writing a
 * `cursor-shape` JSON line to stdout on every tick the cursor is one of
 * those two -- same "spawn once, loop internally" reasoning as the macOS
 * helper's own `cursor-shape-stream` mode (see cursor-shape-tracker.ts):
 * a useful poll rate (fast enough to catch a brief resize drag) is far too
 * fast to re-spawn a fresh process per tick the way `getWin32WindowBounds`
 * does for its much slower 500ms poll.
 *
 * Same inline `Add-Type`/P-Invoke idiom this codebase already uses for
 * one-shot Win32 queries (win-window-bounds.ts, win-window-focus.ts), just
 * looping inside the script itself instead of exiting after one query, so
 * there's still no Win32 FFI dependency in this codebase.
 *
 * NOTE: this path has not been run on real Windows hardware from this
 * (macOS) development environment -- same disclosure as this codebase's
 * other from-reference/unverified Windows/Linux native code.
 */
export function spawnWin32CursorShapeStream(): ChildProcessByStdio<null, Readable, null> | null {
  if (process.platform !== 'win32') return null;

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class BpCursorShape {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)]
  public struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public POINT ptScreenPos; }
  [DllImport("user32.dll")]
  public static extern bool GetCursorInfo(out CURSORINFO info);
  [DllImport("user32.dll")]
  public static extern IntPtr LoadCursor(IntPtr hInstance, IntPtr lpCursorName);
}
"@
$sizeWe = [BpCursorShape]::LoadCursor([IntPtr]::Zero, [IntPtr]32644)
$sizeNs = [BpCursorShape]::LoadCursor([IntPtr]::Zero, [IntPtr]32645)
while ($true) {
  $info = New-Object BpCursorShape+CURSORINFO
  $info.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($info)
  if ([BpCursorShape]::GetCursorInfo([ref]$info)) {
    if ($info.hCursor -eq $sizeWe) {
      Write-Output '{"event":"cursor-shape","kind":"horizontal"}'
    } elseif ($info.hCursor -eq $sizeNs) {
      Write-Output '{"event":"cursor-shape","kind":"vertical"}'
    }
  }
  Start-Sleep -Milliseconds 50
}
`;

  return spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  }) as ChildProcessByStdio<null, Readable, null>;
}
