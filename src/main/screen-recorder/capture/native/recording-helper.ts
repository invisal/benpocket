import { spawn, type ChildProcessByStdio } from 'child_process';
import { accessSync, constants as fsConstants } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import type { Readable, Writable } from 'stream';
import { app } from 'electron';
import type {
  NativeRecordingOptions,
  NativeRecordingSupport,
  NativeRecordingStartResult,
  NativeRecordingStopResult
} from '@shared/native-capture';
import { usesOsCapturePicker } from '@shared/uses-os-capture-picker';
import { getWin32WindowBounds } from './win-window-bounds';
import { focusWin32Window } from './win-window-focus';

/**
 * Manages the per-platform native recording helper subprocess -- see
 * @shared/native-capture.ts for the full contract/rationale. Each platform
 * ships its own standalone executable (native/macos-recorder,
 * native/windows-recorder) that owns the entire capture pipeline
 * internally; this module's only job is spawning it, building the JSON
 * config it expects, and normalizing its stdout/stderr protocol into a
 * small set of lifecycle events both platforms share, since the two
 * helpers' wire formats differ in real ways (nested vs. flat JSON, where
 * errors are reported, exact field names) -- see MAC_ADAPTER/WINDOWS_ADAPTER
 * below for those differences instead of trying to force one shared shape
 * onto both (proven) reference implementations.
 *
 * LINUX_ADAPTER (native/linux-recorder) is a different case from the other
 * two: there was no reference implementation to adapt for Linux, and it has
 * never been compiled or run on real Linux hardware from this development
 * environment -- see that helper's own main.cpp for the full disclosure.
 * Its wire format is this module's own design (flat JSON, matching
 * WINDOWS_ADAPTER's convention), so at least the *shape* of the contract is
 * internally consistent even though the implementation behind it is
 * unverified.
 */

type NormalizedEvent =
  | { type: 'ready' }
  | { type: 'started' }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'stopped'; outputPath: string }
  | { type: 'error'; message: string }
  | { type: 'other' };

interface HelperAdapter {
  helperFileName: string;
  buildConfig(options: NativeRecordingOptions): string;
  parseStdoutLine(line: string): NormalizedEvent | null;
  parseStderrLine(line: string): NormalizedEvent | null;
}

const MAC_ADAPTER: HelperAdapter = {
  helperFileName: 'benpocket-macos-recorder-helper',
  buildConfig(options) {
    return JSON.stringify({
      schemaVersion: 1,
      source: {
        type: options.source.kind,
        displayId: options.source.displayId ?? null,
        windowHandle: options.source.windowHandle ?? null,
        windowTitle: options.source.windowTitle ?? null,
        bounds: options.source.bounds ?? null,
        cropFraction: options.source.cropFraction ?? null
      },
      video: {
        fps: options.frameRate,
        width: options.width,
        height: options.height,
        bitrate: null,
        hideCursor: options.hideCursor
      },
      audio: {
        system: { enabled: options.systemAudioEnabled },
        microphone: {
          enabled: options.microphoneEnabled,
          deviceId: options.microphoneDeviceId ?? null,
          deviceName: options.microphoneDeviceName ?? null
        }
      },
      outputPath: options.outputPath
    });
  },
  parseStdoutLine(line) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return null;
    }
    switch (payload.event) {
      case 'ready':
        return { type: 'ready' };
      case 'recording-started':
        return { type: 'started' };
      case 'recording-paused':
        return { type: 'paused' };
      case 'recording-resumed':
        return { type: 'resumed' };
      case 'recording-stopped':
        return { type: 'stopped', outputPath: String(payload.outputPath ?? '') };
      case 'error':
        return { type: 'error', message: String(payload.message ?? 'Unknown helper error') };
      default:
        return { type: 'other' };
    }
  },
  // The macOS helper reports every failure via a stdout JSON `error` event
  // -- nothing meaningful ever arrives on stderr.
  parseStderrLine() {
    return null;
  }
};

const WINDOWS_ADAPTER: HelperAdapter = {
  helperFileName: 'benpocket-windows-recorder-helper.exe',
  buildConfig(options) {
    return JSON.stringify({
      schemaVersion: 2,
      sourceType: options.source.kind,
      displayId: options.source.displayId ?? 0,
      // This helper's config parser reads windowHandle as a *string*
      // (decimal or "0x..." hex), not a JSON number -- see main.cpp's
      // parseWindowHandle.
      windowHandle: options.source.windowHandle != null ? String(options.source.windowHandle) : '',
      outputPath: options.outputPath,
      fps: options.frameRate,
      videoWidth: options.width,
      videoHeight: options.height,
      displayX: options.source.bounds?.x ?? 0,
      displayY: options.source.bounds?.y ?? 0,
      displayW: options.source.bounds?.width ?? 0,
      displayH: options.source.bounds?.height ?? 0,
      hasDisplayBounds: options.source.bounds != null,
      hasCropFraction: options.source.cropFraction != null,
      cropFractionX: options.source.cropFraction?.x ?? 0,
      cropFractionY: options.source.cropFraction?.y ?? 0,
      cropFractionW: options.source.cropFraction?.width ?? 1,
      cropFractionH: options.source.cropFraction?.height ?? 1,
      captureSystemAudio: options.systemAudioEnabled,
      captureMic: options.microphoneEnabled,
      // Inverted from `hideCursor` -- adopted verbatim from the reference,
      // which names this flag positively ("capture the cursor"); renaming
      // its internals wasn't worth the risk on code that can't be tested
      // from this environment.
      captureCursor: !options.hideCursor,
      webcamEnabled: false,
      microphoneDeviceId: options.microphoneDeviceId ?? '',
      microphoneDeviceName: options.microphoneDeviceName ?? ''
    });
  },
  parseStdoutLine(line) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(line) as Record<string, unknown>;
    } catch {
      // Legacy plain-text lines ("Recording started", "Recording stopped.
      // Output path: ...") also ship on stdout for backward compatibility
      // with the reference's own older integration -- the JSON events are
      // authoritative, these are just ignored.
      return null;
    }
    switch (payload.event) {
      case 'ready':
        return { type: 'ready' };
      case 'recording-started':
        return { type: 'started' };
      case 'recording-paused':
        return { type: 'paused' };
      case 'recording-resumed':
        return { type: 'resumed' };
      case 'recording-stopped':
        return { type: 'stopped', outputPath: String(payload.screenPath ?? '') };
      default:
        return { type: 'other' };
    }
  },
  // Unlike macOS, this helper reports fatal errors as plain "ERROR: ..."
  // lines on stderr, not JSON on stdout.
  parseStderrLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('ERROR:')) return null;
    return { type: 'error', message: trimmed.slice('ERROR:'.length).trim() };
  }
};

const LINUX_ADAPTER: HelperAdapter = {
  helperFileName: 'benpocket-linux-recorder-helper',
  buildConfig(options) {
    return JSON.stringify({
      sourceType: options.source.kind,
      displayId: options.source.displayId ?? 0,
      windowId: options.source.windowHandle ?? 0,
      hasBounds: options.source.bounds != null,
      boundsX: options.source.bounds?.x ?? 0,
      boundsY: options.source.bounds?.y ?? 0,
      boundsW: options.source.bounds?.width ?? 0,
      boundsH: options.source.bounds?.height ?? 0,
      hasCropFraction: options.source.cropFraction != null,
      cropFractionX: options.source.cropFraction?.x ?? 0,
      cropFractionY: options.source.cropFraction?.y ?? 0,
      cropFractionW: options.source.cropFraction?.width ?? 1,
      cropFractionH: options.source.cropFraction?.height ?? 1,
      fps: options.frameRate,
      width: options.width,
      height: options.height,
      hideCursor: options.hideCursor,
      systemAudioEnabled: options.systemAudioEnabled,
      micEnabled: options.microphoneEnabled,
      micDeviceId: options.microphoneDeviceId ?? '',
      outputPath: options.outputPath
    });
  },
  parseStdoutLine(line) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return null;
    }
    switch (payload.event) {
      case 'ready':
        return { type: 'ready' };
      case 'recording-started':
        return { type: 'started' };
      case 'recording-paused':
        return { type: 'paused' };
      case 'recording-resumed':
        return { type: 'resumed' };
      case 'recording-stopped':
        return { type: 'stopped', outputPath: String(payload.outputPath ?? '') };
      case 'error':
        return { type: 'error', message: String(payload.message ?? 'Unknown helper error') };
      default:
        return { type: 'other' };
    }
  },
  // Like macOS, every failure is reported via a stdout JSON `error` event --
  // ffmpeg's own stderr is redirected to /dev/null by the helper itself
  // rather than left to mix into this JSON event stream.
  parseStderrLine() {
    return null;
  }
};

function adapterForPlatform(): HelperAdapter | null {
  if (process.platform === 'darwin') return MAC_ADAPTER;
  if (process.platform === 'win32') return WINDOWS_ADAPTER;
  if (process.platform === 'linux') return LINUX_ADAPTER;
  return null;
}

/**
 * Candidate helper binary locations, in priority order -- mirrors the
 * reference implementation's own `helperCandidates()` convention: an env
 * var override for local development/diagnostics, the local build output
 * for a dev checkout, then the packaged app's bundled resources.
 */
function helperCandidates(adapter: HelperAdapter): string[] {
  const envPath = process.env.BENPOCKET_NATIVE_RECORDER_HELPER?.trim();
  const archTag = `${process.platform}-${process.arch}`;
  const appRoot = app.getAppPath();
  const resourcesRoot = app.isPackaged ? process.resourcesPath : appRoot;
  const packagedPath = join(resourcesRoot, 'native', 'bin', archTag, adapter.helperFileName);

  // A packaged build's appRoot is app.asar -- even with the source/build
  // trees excluded from packaging (see electron-builder.yml), spawn()
  // can never execve a path *inside* an asar archive (ENOTDIR), so this
  // raw-build-output candidate is only ever meaningful for a dev checkout.
  if (app.isPackaged) return [envPath, packagedPath].filter((c): c is string => Boolean(c));

  const localBuildPath =
    process.platform === 'darwin'
      ? join(
          appRoot,
          'native',
          'macos-recorder',
          '.build',
          process.arch === 'arm64' ? 'arm64-apple-macosx' : 'x86_64-apple-macosx',
          'release',
          adapter.helperFileName
        )
      : process.platform === 'linux'
        ? join(appRoot, 'native', 'linux-recorder', 'build', adapter.helperFileName)
        : join(appRoot, 'native', 'windows-recorder', 'build', 'Release', adapter.helperFileName);

  return [envPath, localBuildPath, packagedPath].filter((c): c is string => Boolean(c));
}

function findHelperPath(adapter: HelperAdapter): string | null {
  for (const candidate of helperCandidates(adapter)) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Try the next candidate location.
    }
  }
  return null;
}

interface ActiveSession {
  child: ChildProcessByStdio<Writable, Readable, Readable>;
  outputPath: string;
  events: EventEmitter;
}

/** Only one recording happens at a time in this app -- module-level singleton, same pattern as cursor-tracker.ts/recording-controller.ts. */
let activeSession: ActiveSession | null = null;

export function checkNativeRecordingSupport(): NativeRecordingSupport {
  const adapter = adapterForPlatform();
  if (!adapter) return { supported: false, supportsCrop: false };
  // LINUX_ADAPTER's helper captures via raw X11 (XGetWindowAttributes,
  // XRandR CRTCs, MIT-SHM against the root window/a window's own XID -- see
  // that helper's own main.cpp) -- none of which exists on Wayland, whose
  // compositor doesn't hand out real XIDs and isn't reliably represented by
  // the root window even under XWayland. Reusing usesOsCapturePicker's
  // Wayland check here (same env-var detection, different reason) skips
  // straight to the legacy getUserMedia/chromeMediaSourceId path -- which
  // *does* work under Wayland via Chromium's own PipeWire integration --
  // instead of spawning a helper that's certain to fail.
  if (process.platform === 'linux' && usesOsCapturePicker()) {
    return { supported: false, supportsCrop: false };
  }
  const supported = findHelperPath(adapter) !== null;
  // All three helpers now implement `cropFraction` (ScreenCaptureKit's
  // sourceRect on macOS, a D3D11 CopySubresourceRegion crop on Windows, an
  // XShmGetImage source-rect offset on Linux) -- see each's own main.
  return { supported, supportsCrop: supported };
}

function wireStreamEvents(
  child: ChildProcessByStdio<Writable, Readable, Readable>,
  adapter: HelperAdapter,
  events: EventEmitter
): void {
  let stdoutBuffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = adapter.parseStdoutLine(line);
      if (event) {
        console.log('[recording-helper] event:', event);
        events.emit('event', event);
      }
    }
  });

  let stderrBuffer = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderrBuffer += chunk;
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      console.error('[recording-helper][stderr]', line);
      const event = adapter.parseStderrLine(line);
      if (event) events.emit('event', event);
    }
  });
}

export async function startNativeRecording(
  options: NativeRecordingOptions
): Promise<NativeRecordingStartResult> {
  // A stale session from a prior recording must never linger across a new start.
  await stopNativeRecording();

  const adapter = adapterForPlatform();
  if (!adapter) return { ok: false, reason: 'Native recording is not supported on this platform.' };

  const helperPath = findHelperPath(adapter);
  if (!helperPath) return { ok: false, reason: 'Native recording helper binary not found.' };

  const config = adapter.buildConfig(options);
  const events = new EventEmitter();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: NativeRecordingStartResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    const child = spawn(helperPath, [config], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    }) as ChildProcessByStdio<Writable, Readable, Readable>;

    wireStreamEvents(child, adapter, events);
    events.on('event', (event: NormalizedEvent) => {
      // "recording-started" (not just "ready") is the real confirmation
      // frames are actually flowing -- "ready" alone fires before capture
      // is confirmed to have actually begun.
      if (event.type === 'started') finish({ ok: true, outputPath: options.outputPath });
      else if (event.type === 'error') finish({ ok: false, reason: event.message });
    });

    child.once('error', (err) => finish({ ok: false, reason: err.message }));
    child.once('exit', (code, signal) => {
      if (activeSession?.child === child) activeSession = null;
      finish({
        ok: false,
        reason: `Helper exited before starting (code=${code}, signal=${signal})`
      });
    });

    activeSession = { child, outputPath: options.outputPath, events };

    const timeoutId = setTimeout(() => {
      finish({ ok: false, reason: 'Timed out waiting for native recording to start' });
    }, 10_000);
  });
}

export function pauseNativeRecording(): void {
  activeSession?.child.stdin.write('pause\n');
}

export function resumeNativeRecording(): void {
  activeSession?.child.stdin.write('resume\n');
}

export async function stopNativeRecording(): Promise<NativeRecordingStopResult> {
  const session = activeSession;
  if (!session) return { ok: false, reason: 'No active native recording session.' };
  activeSession = null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: NativeRecordingStopResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    session.events.on('event', (event: NormalizedEvent) => {
      if (event.type === 'stopped')
        finish({ ok: true, outputPath: event.outputPath || session.outputPath });
      else if (event.type === 'error') finish({ ok: false, reason: event.message });
    });
    session.child.once('exit', () => finish({ ok: true, outputPath: session.outputPath }));

    session.child.stdin.write('stop\n');

    const timeoutId = setTimeout(() => {
      // Best-effort force-kill if the helper never confirms -- better than
      // leaving an orphaned process (and, on macOS, a stuck OS-level
      // "recording" indicator) hanging around indefinitely.
      if (!session.child.killed) session.child.kill('SIGTERM');
      finish({ ok: true, outputPath: session.outputPath });
    }, 15_000);
  });
}

export interface WindowBoundsResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Looks up a window's real on-screen bounds by its native handle (the same
 * numeric id embedded in desktopCapturer's `window:<handle>:0` source id,
 * already relied on for window-target resolution -- see
 * capture-engine.ts's toNativeRecordingSource). Used to normalize cursor-
 * tracking samples against a real rect for *any* selected window, not just
 * a hardcoded special case -- see useRecordingController.ts.
 *
 * A one-shot spawn of the same helper binary in a lightweight query mode
 * (no ScreenCaptureKit session, no recording side effects) -- see
 * queryWindowBounds() in main.swift. macOS only for now: Quartz Window
 * Services has no Windows equivalent wired up here, so this always
 * resolves null there (same convention the old AppleScript-based window-
 * bounds lookup this replaces used).
 */
function queryWindowBounds(
  windowId: number,
  mode: 'window-bounds' | 'window-bounds-live'
): Promise<WindowBoundsResult | null> {
  if (process.platform !== 'darwin') return Promise.resolve(null);

  const helperPath = findHelperPath(MAC_ADAPTER);
  if (!helperPath) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: WindowBoundsResult | null): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const child = spawn(helperPath, [JSON.stringify({ mode, windowId })], {
      stdio: ['ignore', 'pipe', 'ignore']
    });

    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.once('error', () => finish(null));
    child.once('exit', () => {
      const line = stdout.split(/\r?\n/).find((candidate) => candidate.trim());
      if (!line) {
        finish(null);
        return;
      }
      try {
        const payload = JSON.parse(line) as Record<string, unknown>;
        if (payload.event !== 'window-bounds' || !payload.found) {
          finish(null);
          return;
        }
        finish({
          x: Number(payload.x),
          y: Number(payload.y),
          width: Number(payload.width),
          height: Number(payload.height)
        });
      } catch {
        finish(null);
      }
    });
  });
}

export function getWindowBoundsById(windowId: number): Promise<WindowBoundsResult | null> {
  if (process.platform === 'win32') return getWin32WindowBounds(windowId);
  return queryWindowBounds(windowId, 'window-bounds');
}

/**
 * Same result shape as `getWindowBoundsById`, but backed by Quartz Window
 * Services (`CGWindowListCopyWindowInfo`) instead of ScreenCaptureKit's
 * `SCShareableContent` -- see queryWindowBoundsQuartz() in main.swift for
 * why: this is the one meant to be called *repeatedly* while a recording is
 * live (see window-bounds-poller.ts), and hammering SCShareableContent from
 * a second process while the real recording's SCStream is running was
 * observed to interrupt that stream (SCStreamErrorDomain -3805). Quartz
 * Window Services doesn't touch the ScreenCaptureKit daemon at all, so it
 * can't cause that. `getWindowBoundsById` (SCShareableContent-based) stays
 * the one used for the one-shot pre-recording refresh, where there's no
 * live stream yet to interrupt and exact agreement with what
 * ScreenCaptureKit itself would resolve matters more.
 */
export function getWindowBoundsLive(windowId: number): Promise<WindowBoundsResult | null> {
  // No SCStream-interruption concern on Windows (see queryWindowBounds's
  // doc for why macOS needs two separate lookup strategies) -- the same
  // DWM-backed query is safe to poll repeatedly here.
  if (process.platform === 'win32') return getWin32WindowBounds(windowId);
  return queryWindowBounds(windowId, 'window-bounds-live');
}

/**
 * Resolves the display name of the app owning a window -- a one-shot spawn
 * of the same helper binary the real recording uses, in the same
 * lightweight query mode as `queryWindowBounds`/`queryWindowBoundsQuartz`
 * (see `resolveWindowOwnerName()` in main.swift). Deliberately *not* shelled
 * out to `osascript` for this step (what mac-window-focus.ts, now removed,
 * used to do for the whole operation): resolving a window's owner needs
 * Screen Recording permission, scoped to the *calling process's* own TCC
 * identity -- `osascript` is a separate, Apple-signed binary with no grant
 * of its own, and nothing in this app ever requested one for it, so that
 * path silently found nothing on every machine. This helper binary already
 * holds that grant legitimately, as the actual capture engine.
 */
function resolveWindowOwnerNameMac(windowId: number): Promise<string | null> {
  const helperPath = findHelperPath(MAC_ADAPTER);
  if (!helperPath) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: string | null): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const child = spawn(helperPath, [JSON.stringify({ mode: 'focus-window', windowId })], {
      stdio: ['ignore', 'pipe', 'ignore']
    });

    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.once('error', () => finish(null));
    child.once('exit', () => {
      const line = stdout.split(/\r?\n/).find((candidate) => candidate.trim());
      if (!line) {
        finish(null);
        return;
      }
      try {
        const payload = JSON.parse(line) as Record<string, unknown>;
        finish(
          payload.event === 'focus-window' && typeof payload.ownerName === 'string'
            ? payload.ownerName
            : null
        );
      } catch {
        finish(null);
      }
    });
  });
}

/**
 * Actually brings `appName` to the foreground via `tell application "..." to
 * activate` -- confirmed by hand that this reliably works, unlike calling
 * `NSRunningApplication.activate()` directly from the helper process above
 * (which returns success but the target never visibly comes forward, almost
 * certainly macOS's focus-stealing protection for a process with no
 * foreground/UI activation context of its own -- osascript's AppleScript
 * `activate` command goes through the Apple Event Manager instead, a
 * different path that isn't subject to the same restriction). Escapes `"`/`\`
 * since `appName` is interpolated directly into the script string, same
 * reasoning as window-bounds.ts's `processName` interpolation.
 */
function activateMacApp(appName: string): Promise<boolean> {
  const escaped = appName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return new Promise((resolve) => {
    const child = spawn('osascript', ['-e', `tell application "${escaped}" to activate`], {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(code === 0));
  });
}

/**
 * macOS half of `focusCaptureWindowById` -- splits the operation across the
 * two mechanisms each half is actually reliable at (see each function's own
 * doc for why): the native helper (already holds Screen Recording) resolves
 * *which app* owns the window, then `osascript` (proven to reliably
 * activate, unlike calling AppKit directly from a bare command-line process)
 * actually brings it forward.
 */
async function focusWindowMac(windowId: number): Promise<boolean> {
  const ownerName = await resolveWindowOwnerNameMac(windowId);
  if (!ownerName) return false;
  return activateMacApp(ownerName);
}

/**
 * Brings a 'window' source's target window to the foreground before
 * recording starts (see useRecordingController.ts) -- Win32's
 * `SetForegroundWindow` on Windows (see win-window-focus.ts), app-level
 * `NSRunningApplication.activate` via the native helper on macOS (see
 * `focusWindowMac` above). No-op (resolves false) on Linux -- consistent
 * with the rest of this codebase's Linux disclaimers (see LINUX_ADAPTER's
 * own doc above), there's no verified reference implementation for this
 * there either.
 */
export function focusCaptureWindowById(windowId: number): Promise<boolean> {
  if (process.platform === 'win32') return focusWin32Window(windowId);
  if (process.platform === 'darwin') return focusWindowMac(windowId);
  return Promise.resolve(false);
}

/** Safety net for abnormal termination -- see main/index.ts's `before-quit` hook. */
export function killActiveNativeRecording(): void {
  if (activeSession && !activeSession.child.killed) {
    activeSession.child.kill('SIGTERM');
  }
  activeSession = null;
}
