import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Brings a window to the foreground on Windows, restoring it first if it's
 * minimized -- called right before a 'window' source recording starts (see
 * useRecordingController.ts) so the recorded window is actually visible and
 * un-minimized when capture/bounds-resolution begins. Without this, picking
 * a window from the source list and then clicking "Start Recording" (which
 * doesn't itself refocus anything) can leave that window minimized or
 * behind the app's own toolbar/picker windows: a minimized window reports
 * its bounds at Windows' off-screen sentinel position, which silently drops
 * every cursor sample as "out of bounds" (see cursor-tracker.ts), and WGC
 * capture of an occluded/minimized window can render blank.
 *
 * `SetForegroundWindow` is subject to Windows' foreground-lock restriction --
 * an arbitrary process (this spawned `powershell.exe`, in particular) can't
 * normally steal focus outside of a few specific conditions. The standard
 * workaround, used here, is to attach this process's input queue to the
 * *current* foreground window's thread via `AttachThreadInput` before
 * calling `SetForegroundWindow`, which Windows does allow, then detach
 * immediately after.
 */
export function focusWin32Window(hwnd: number): Promise<boolean> {
  if (process.platform !== 'win32') return Promise.resolve(false);
  if (!Number.isInteger(hwnd) || hwnd <= 0) return Promise.resolve(false);

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class BpWindowFocus {
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hwnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")]
  public static extern bool BringWindowToTop(IntPtr hwnd);
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hwnd, IntPtr processId);
  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")]
  public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
}
"@
$hwnd = [IntPtr]${hwnd}
if (-not [BpWindowFocus]::IsWindow($hwnd)) { Write-Output '{"ok":false}'; exit }

if ([BpWindowFocus]::IsIconic($hwnd)) {
  [BpWindowFocus]::ShowWindow($hwnd, 9) | Out-Null   # SW_RESTORE
}

$fg = [BpWindowFocus]::GetForegroundWindow()
$fgThread = [BpWindowFocus]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
$thisThread = [BpWindowFocus]::GetCurrentThreadId()
$attached = $false
if ($fgThread -ne 0 -and $fgThread -ne $thisThread) {
  $attached = [BpWindowFocus]::AttachThreadInput($thisThread, $fgThread, $true)
}

[BpWindowFocus]::BringWindowToTop($hwnd) | Out-Null
$ok = [BpWindowFocus]::SetForegroundWindow($hwnd)

if ($attached) {
  [BpWindowFocus]::AttachThreadInput($thisThread, $fgThread, $false) | Out-Null
}

$result = @{ ok = $ok }
$result | ConvertTo-Json -Compress
`;

  return execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
    .then(({ stdout }) => {
      const trimmed = stdout.trim();
      if (!trimmed) return false;
      const payload = JSON.parse(trimmed) as Record<string, unknown>;
      return payload.ok === true;
    })
    .catch((err: unknown) => {
      console.warn(`[win-window-focus] failed to focus hwnd ${hwnd}:`, err);
      return false;
    });
}
