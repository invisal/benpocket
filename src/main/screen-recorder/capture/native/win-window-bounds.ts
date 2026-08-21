import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface Win32WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Resolves a window's on-screen bounds on Windows via
 * `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)` -- the actual visible
 * rect a modern (DWM-composited) window occupies, unlike `GetWindowRect`,
 * which still includes the invisible resize-border padding Windows 10/11
 * pads around a non-maximized window for its drop shadow/snap margin. Falls
 * back to `GetWindowRect` if the DWM call fails (composition off, or the hwnd
 * belongs to a window DWM doesn't track), since an approximate rect still
 * beats no cursor/click tracking at all -- see cursor-capture.ts, which skips
 * tracking entirely when a source has no resolved bounds.
 *
 * There's no Win32 FFI dependency in this codebase, so this shells out to
 * `powershell.exe` with an inline C# P/Invoke snippet, same pattern as
 * nativeClipboard.ts/copy-file-to-clipboard.ts. Called once up front when a
 * 'window' source recording starts, then every 500ms while the recorded
 * window is being followed (see window-bounds-poller.ts) -- not a hot path,
 * so the ~50-100ms powershell startup cost per call is fine.
 */
export function getWin32WindowBounds(hwnd: number): Promise<Win32WindowBounds | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  if (!Number.isInteger(hwnd) || hwnd <= 0) return Promise.resolve(null);

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class BpWindowBounds {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("dwmapi.dll")]
  public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out RECT rect, int size);
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hwnd);
}
"@
$hwnd = [IntPtr]${hwnd}
if (-not [BpWindowBounds]::IsWindow($hwnd)) { exit }
$rect = New-Object BpWindowBounds+RECT
$hr = [BpWindowBounds]::DwmGetWindowAttribute($hwnd, 9, [ref]$rect, 16)
if ($hr -ne 0) {
  if (-not [BpWindowBounds]::GetWindowRect($hwnd, [ref]$rect)) { exit }
}
$result = @{ x = $rect.Left; y = $rect.Top; width = ($rect.Right - $rect.Left); height = ($rect.Bottom - $rect.Top) }
$result | ConvertTo-Json -Compress
`;

  return execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
    .then(({ stdout }) => {
      const trimmed = stdout.trim();
      if (!trimmed) return null;
      const payload = JSON.parse(trimmed) as Record<string, unknown>;
      const { x, y, width, height } = payload;
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        width <= 0 ||
        height <= 0
      ) {
        return null;
      }
      return { x, y, width, height };
    })
    .catch((err: unknown) => {
      console.warn(`[win-window-bounds] failed to resolve bounds for hwnd ${hwnd}:`, err);
      return null;
    });
}
