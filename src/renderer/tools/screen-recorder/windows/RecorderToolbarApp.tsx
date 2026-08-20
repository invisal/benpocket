import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  AppWindow,
  Crop,
  GripVertical,
  Loader2,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Square,
  Trash2,
  Video,
  VideoOff,
  X
} from 'lucide-react';
import { cn } from 'cnfast';
import { Popover } from '@renderer/components/ui/Popover';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import type {
  AudioInputOptions,
  CaptureSource,
  CaptureTargetType,
  WebcamOptions
} from '@screen-recorder/types/recording';
import type { CaptureRegionSelection } from '@shared/capture-region';
import type {
  RecorderToolbarOpenPayload,
  RecorderToolbarRecordingResult
} from '@shared/recorder-toolbar';
import { pickDefaultCaptureSource } from '../features/recording/lib/pick-default-capture-source';
import { usePermission } from '../features/permissions/hooks/usePermission';
import { isLikelyMac } from '../lib/platform';
import { Button } from '@renderer/components/ui/Button';

const TABS: { type: CaptureTargetType; label: string; icon: typeof Monitor }[] = [
  { type: 'screen', label: 'Display', icon: Monitor },
  { type: 'window', label: 'Window', icon: AppWindow }
];

const SHAPES: { value: WebcamOptions['shape']; label: string; className: string }[] = [
  { value: 'circle', label: 'Circle', className: 'rounded-full' },
  { value: 'rounded-square', label: 'Rounded', className: 'rounded-[4px]' },
  { value: 'square', label: 'Square', className: 'rounded-none' }
];

const DEFAULT_WEBCAM: WebcamOptions = {
  enabled: false,
  shape: 'circle',
  mirrored: true,
  position: { x: 24, y: 24 },
  size: 180,
  shadow: 40
};

function parseInit(): RecorderToolbarOpenPayload | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('init');
    return raw ? (JSON.parse(raw) as RecorderToolbarOpenPayload) : null;
  } catch {
    return null;
  }
}

// Fallback for a permission that was fine at the pre-flight checks below but
// got revoked/denied at the actual native-helper request in between (see
// main.swift's HelperError.permissionDenied) -- legacy getUserMedia never
// throws this, it just silently records black frames instead.
function isPermissionError(message: string): boolean {
  return /permission/i.test(message);
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

type Mode = 'setup' | 'counting' | 'starting' | 'recording' | 'paused' | 'restarting' | 'stopping';

// Carries its own settings-action so screen/mic/camera permission failures
// can each drive the same banner treatment without the banner hardcoding
// which permission kind (and which native settings pane) it's about.
type ToolbarError = { message: string; openSettings?: () => void; settingsLabel?: string };

// The window is frameless (see recorder-toolbar-window.ts's `movable: true`),
// so dragging has to be opted into via CSS rather than a native titlebar.
// `drag` goes on the pill's own background; every interactive element
// inside needs `no-drag` or Chromium swallows its clicks as window-drag
// gestures instead. Tailwind has no built-in utility for this property, so
// these use arbitrary-value syntax.
const DRAG = '[-webkit-app-region:drag]';
const NO_DRAG = '[-webkit-app-region:no-drag]';

// Only ever wired to onMouseEnter, deliberately never onMouseLeave: Chromium
// fires a synthetic mouseleave on the pill the instant a native
// `-webkit-app-region: drag` window-move gesture takes over the pointer, and
// that leave calling disablePointerEvents mid-drag killed the drag before it
// could go anywhere. Enter-only still covers every real transition -- moving
// from the dead-space overlay onto the pill/an open popover fires *their*
// onMouseEnter (enable), and moving back the other way fires the overlay's
// (disable) -- without ever needing to react to something leaving. Note
// this can't be what turns ignoring off in the first place while the window
// is still ignoring -- see the interactive-region poll in
// recorder-toolbar-window.ts, which handles that instead.
function enablePointerEvents(): void {
  void window.screenRecorder.window.setIgnoreMouseEvents(false);
}
function disablePointerEvents(): void {
  void window.screenRecorder.window.setIgnoreMouseEvents(true);
}

/**
 * The floating, always-on-top control bar shown while the main Craftbox
 * window is hidden (see main/screen-recorder/windows/recorder-toolbar-window.ts)
 * so the user sees their actual desktop/window instead of a copy rendered
 * inside the app. This is a fully separate renderer process from the main
 * window -- it keeps its own local copy of audio/webcam settings (seeded
 * from the `init` query param) and only ever hands the *final* choice back
 * across the IPC boundary as plain data; nothing here shares store identity
 * with the main window.
 */
export function RecorderToolbarApp(): JSX.Element | null {
  const init = useMemo(() => parseInit(), []);
  const screenPermission = usePermission('screen');
  const micPermission = usePermission('microphone');
  const cameraPermission = usePermission('camera');
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(init?.source?.id ?? null);
  const [audio, setAudio] = useState<AudioInputOptions>(
    init?.audio ?? { microphoneEnabled: true, systemAudioEnabled: false }
  );
  const [webcam, setWebcam] = useState<WebcamOptions>(init?.webcam ?? DEFAULT_WEBCAM);
  const [cropRegion, setCropRegion] = useState<CaptureRegionSelection | null>(
    init?.cropRegion ?? null
  );
  // Which of Display/Window the user has actually clicked -- starts at
  // null (neither highlighted) rather than derived from the initial
  // sourceId's type, which would make a tab look pre-selected before the
  // user has interacted with anything.
  const [activeTab, setActiveTab] = useState<CaptureTargetType | null>(null);
  const [mode, setMode] = useState<Mode>('setup');
  const [error, setError] = useState<ToolbarError | null>(null);
  const [openPopover, setOpenPopover] = useState<'camera' | 'device' | 'mic' | null>(null);
  // Which device kind the user picked via the Device popover below, purely
  // to highlight the right label on the button -- the actual selection lives
  // in sourceId/cropRegion like every other pick.
  const [selectedDevice, setSelectedDevice] = useState<'simulator' | 'emulator' | null>(null);
  const [bootedSimulatorName, setBootedSimulatorName] = useState<string | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  // Cursor visibility/click-highlight/countdown are round-tripped through the
  // start payload as whatever the main window handed over when it opened this
  // toolbar (see openRecorderToolbarFor) -- nothing in this toolbar changes
  // them, so these are fixed for the toolbar's lifetime rather than state.
  const cursorVisible = init?.cursorSettings.visible ?? true;
  const clickHighlight = init?.cursorSettings.clickRippleEnabled ?? false;
  const countdownSeconds = init?.countdownSeconds ?? 0;
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  // Only the native helper path supports Pause/Resume (see CaptureHandle.native)
  // -- set from the start result once a recording actually begins.
  const [nativeActive, setNativeActive] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [micDeviceLabel, setMicDeviceLabel] = useState<string | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const cameraPreviewStreamRef = useRef<MediaStream | null>(null);
  const micLevelBarRef = useRef<HTMLDivElement>(null);
  const pausedDurationRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deleteArmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  function beginRecording(
    source: CaptureSource,
    regionOverride?: CaptureRegionSelection | null
  ): void {
    setMode('starting');
    const region = regionOverride !== undefined ? regionOverride : cropRegion;
    // The drag-selected Area rect is the most specific target available;
    // otherwise fall back to the source's own display bounds (only ever
    // resolved for a 'screen' source, or a 'window' source with a known
    // owner -- currently just the Simulator -- see CaptureSource.displayBounds).
    // A generic window with no bounds just leaves this undefined, and the
    // toolbar stays wherever it already is.
    const targetBounds = region?.rect ?? source.displayBounds;
    window.screenRecorder.recorderToolbar.requestStart({
      source,
      audio,
      webcam,
      cropRegion: region ?? undefined,
      targetBounds,
      cursorSettings: { visible: cursorVisible, clickRippleEnabled: clickHighlight },
      countdownSeconds
    });
  }

  function cancelCountdown(): void {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownRemaining(null);
    setMode('setup');
  }

  useEffect(
    () => () => {
      if (deleteArmTimeoutRef.current) clearTimeout(deleteArmTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    window.screenRecorder.recording
      .getCaptureSources()
      .then((fetched) => {
        setSources(fetched);
        // Opening "fresh" (no source picked yet, see openRecorderToolbarFor)
        // leaves sourceId null until this resolves -- pick the same default
        // a caller would have, now that the source list actually exists.
        setSourceId((current) => current ?? pickDefaultCaptureSource(fetched)?.id ?? null);
      })
      .catch(() => setSources([]))
      .finally(() => setSourcesLoaded(true));
  }, []);

  // This window is now taller than the pill it shows (see TOOLBAR_HEIGHT in
  // recorder-toolbar-window.ts -- extra headroom for the Camera/Device
  // popovers to open into), so most of its bounds are just transparent
  // empty space, not the pill itself. Without this, that space still
  // captures every click over it -- Electron windows are rectangular and
  // don't punch holes for transparent regions on their own -- blocking
  // whatever's underneath (the desktop, other apps) even though nothing is
  // visibly there. Set once on mount; the dead-space overlay and pill/popover
  // below toggle it back off/on as the mouse actually crosses between them.
  useEffect(() => {
    disablePointerEvents();
  }, []);

  // Same booted-Simulator lookup the main window's SourcePicker uses (see
  // simulator-detection.ts) -- reused here rather than re-implemented, just
  // to know its device name so we can match it against the window sources
  // above and light up the Device popover's Simulator option.
  useEffect(() => {
    window.screenRecorder.simulator
      .getBootedName()
      .then(setBootedSimulatorName)
      .catch(() => setBootedSimulatorName(null));
  }, []);

  useEffect(
    () =>
      window.screenRecorder.recorderToolbar.onRecordingResult(
        (result: RecorderToolbarRecordingResult) => {
          if (result.ok) {
            setMode('recording');
            setRecordingStartedAt(Date.now());
            setNativeActive(result.native ?? false);
            pausedDurationRef.current = 0;
            pauseStartedAtRef.current = null;
            setError(null);
          } else {
            setMode('setup');
            const message = result.error ?? 'Failed to start recording.';
            setError({
              message,
              openSettings: isPermissionError(message) ? screenPermission.openSettings : undefined,
              settingsLabel: 'Open System Settings, then fully quit and reopen benpocket'
            });
          }
        }
      ),
    [screenPermission.openSettings]
  );

  // Stops ticking (and freezes the displayed time) the instant `mode` isn't
  // 'recording' -- covers 'paused' automatically. `pausedDurationRef` is
  // accumulated in handleResume so the displayed elapsed time doesn't jump
  // forward by the pause's length the moment recording resumes, mirroring
  // how the native helper retimes the actual video (see main.swift's
  // totalPausedDuration).
  useEffect(() => {
    if (mode !== 'recording' || recordingStartedAt === null) return;
    const id = setInterval(
      () =>
        setElapsedSeconds(
          Math.floor((Date.now() - recordingStartedAt - pausedDurationRef.current) / 1000)
        ),
      250
    );
    return () => clearInterval(id);
  }, [mode, recordingStartedAt]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      // Cancels just the countdown, not the whole toolbar.
      if (mode === 'counting') {
        cancelCountdown();
        return;
      }
      // Only cancels pre-recording setup -- an active recording only stops
      // via the explicit Stop button, same as the native recorder.
      if (mode === 'setup') window.screenRecorder.recorderToolbar.cancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  // Live self-view + device list while the Camera popover is open -- opening
  // *some* camera stream is also what unlocks real device labels from
  // enumerateDevices() (labels stay blank until a getUserMedia video
  // permission has actually been granted). Stopped as soon as the popover
  // closes so the camera light doesn't stay on during setup.
  useEffect(() => {
    if (openPopover !== 'camera' || !webcam.enabled) {
      cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraPreviewStreamRef.current = null;
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: webcam.deviceId ? { deviceId: { exact: webcam.deviceId } } : true })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraPreviewStreamRef.current = stream;
        if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = stream;

        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setCameraDevices(devices.filter((d) => d.kind === 'videoinput'));
      })
      .catch((err) => console.error('[toolbar] failed to open camera preview:', err));

    return () => {
      cancelled = true;
      cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraPreviewStreamRef.current = null;
    };
  }, [openPopover, webcam.enabled, webcam.deviceId]);

  // Live level meter + real device label while the mic is enabled -- same
  // getUserMedia lifecycle shape as the camera preview above. The meter
  // itself writes straight into a ref'd DOM node via requestAnimationFrame
  // rather than React state, since it updates far too often (~60fps) to
  // push through re-renders.
  useEffect(() => {
    // No reset here when mic is off -- the label is only ever read while
    // `audio.microphoneEnabled` is true (see the Mic button below), so a
    // stale value sitting unused in state until the mic is re-enabled is
    // harmless, and avoids a synchronous setState at the top of this effect.
    if (!audio.microphoneEnabled) return;

    let cancelled = false;
    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;

    navigator.mediaDevices
      .getUserMedia({
        audio: audio.microphoneDeviceId ? { deviceId: { exact: audio.microphoneDeviceId } } : true
      })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = s;
        const track = s.getAudioTracks()[0];
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
        const deviceId = track?.getSettings().deviceId;
        setMicDeviceLabel(
          devices.find((d) => d.deviceId === deviceId)?.label ?? track?.label ?? null
        );

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(s);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        function tick(): void {
          analyser.getByteTimeDomainData(data);
          // RMS of the waveform, normalized -- cheap, standard level-meter math.
          let sumSquares = 0;
          for (const value of data) {
            const centered = (value - 128) / 128;
            sumSquares += centered * centered;
          }
          const level = Math.min(1, Math.sqrt(sumSquares / data.length) * 4);
          if (micLevelBarRef.current) micLevelBarRef.current.style.transform = `scaleX(${level})`;
          rafId = requestAnimationFrame(tick);
        }
        tick();
      })
      .catch(() => setMicDeviceLabel(null));

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    };
  }, [audio.microphoneEnabled, audio.microphoneDeviceId]);

  const focusedSource = sources.find((s) => s.id === sourceId) ?? null;

  // Reports the pill's on-screen rect for the interactive-region poll in
  // recorder-toolbar-window.ts. Keyed on `mode`/`focusedSource` since either
  // can swap the pill element for a different one (or none); ResizeObserver
  // alone wouldn't notice that swap. Also re-measures on an interval, not
  // just on resize, since a window reposition (see repositionToolbar())
  // doesn't fire a resize event but does move the rect.
  useEffect(() => {
    const el = pillRef.current;
    if (!el) {
      window.screenRecorder.window.reportInteractiveRegion(null);
      return;
    }

    function report(): void {
      const node = pillRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      window.screenRecorder.window.reportInteractiveRegion({
        x: Math.round(window.screenX + rect.left),
        y: Math.round(window.screenY + rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    const interval = setInterval(report, 500);
    return () => {
      observer.disconnect();
      clearInterval(interval);
      window.screenRecorder.window.reportInteractiveRegion(null);
    };
  }, [mode, focusedSource]);

  // No on-screen position for either, same as any other 'window' source --
  // matched purely by name against the window list, same heuristic
  // screen-source-provider.ts already uses for the Simulator. There's no
  // adb-based detection for the emulator (nothing else in this codebase
  // shells out to adb), so it's just a name match against Android Studio's
  // emulator window title.
  const simulatorSource = sources.find(
    (s) =>
      s.type === 'window' && bootedSimulatorName !== null && s.name.includes(bootedSimulatorName)
  );
  const emulatorSource = sources.find((s) => s.type === 'window' && /emulator/i.test(s.name));

  // Device popover picks: unlike the Display/Window tabs, there's no overlay
  // step -- a booted Simulator/Emulator is a single known window, so picking
  // it here both selects and highlights it directly (Record still needs an
  // explicit click, same as picking any other source).
  function pickDevice(kind: 'simulator' | 'emulator', source: CaptureSource | undefined): void {
    if (!source) return;
    setSourceId(source.id);
    setCropRegion(null);
    setActiveTab(null);
    setSelectedDevice(kind);
    setOpenPopover(null);
  }

  // Multi-monitor: the drag can land on any connected display, and
  // desktopCapturer's source order has nothing to do with display position
  // (see CaptureSource.isPrimaryDisplay's doc) -- so recording always has
  // to use the source for the display the selection actually resolved
  // against, not just "some screen source", or it silently captures the
  // wrong monitor while the crop rect (correctly) still reads as the one
  // the user dragged on. Center-point containment rather than exact bounds
  // equality, matching screen-capture's own findScreenSourceForRegion.
  function screenSourceForSelection(selection: CaptureRegionSelection): CaptureSource | null {
    const centerX = selection.rect.x + selection.rect.width / 2;
    const centerY = selection.rect.y + selection.rect.height / 2;
    return (
      sources.find((s) => {
        if (s.type !== 'screen' || !s.displayBounds) return false;
        const b = s.displayBounds;
        return (
          centerX >= b.x && centerX < b.x + b.width && centerY >= b.y && centerY < b.y + b.height
        );
      }) ?? null
    );
  }

  // Drag-select a sub-rectangle of a display to record instead of the whole
  // thing. Reuses the same fullscreen overlay window Screen Capture's region
  // screenshot flow uses (main/screen-recorder/windows/region-select-window.ts)
  // -- it's generic ScreenRect-in/CaptureRegionSelection-out plumbing with no
  // screenshot-specific coupling. Hides this window first (mainOnly so it
  // doesn't take the whole app down) so the overlay isn't fighting our own
  // always-on-top pill for the topmost spot. `confirmLabel` puts the overlay
  // into confirm mode (Size/Position readout + a button) instead of
  // completing on mouse-up, so the button click below is the same explicit
  // "start now" action Display/Window's click-to-record overlay already
  // has -- see openSourcePicker. Scoped to the toolbar's own current display
  // (rather than the default whole-virtual-desktop overlay) so dragging the
  // toolbar to a different monitor before picking Area actually changes
  // which monitor gets selected from.
  async function pickArea(): Promise<void> {
    const anyScreenSource = sources.find((s) => s.type === 'screen');
    if (!anyScreenSource) return;
    const bounds = await window.screenRecorder.recorderToolbar.getCurrentDisplayBounds();
    await window.screenRecorder.window.hide({ mainOnly: true });
    try {
      const selection = await window.screenRecorder.screenshot.selectRegion({
        confirmLabel: 'Start recording',
        bounds: bounds ?? undefined
      });
      if (selection) {
        const screenSource = screenSourceForSelection(selection) ?? anyScreenSource;
        setSourceId(screenSource.id);
        setCropRegion(selection);
        // Area has its own highlight (driven by cropRegion) -- clear
        // Display/Window's and Device's so only one control ever reads as active.
        setActiveTab(null);
        setSelectedDevice(null);
        setOpenPopover(null);
        startRecording(screenSource, selection);
      }
    } finally {
      await window.screenRecorder.window.restore({ focus: true });
    }
  }

  // `regionOverride` is for pickArea below: it calls this in the same tick
  // as setCropRegion(selection), and the `cropRegion` state read here would
  // still be the *previous* render's value (React state doesn't update
  // mid-tick) without it.
  function startRecording(
    source: CaptureSource,
    regionOverride?: CaptureRegionSelection | null
  ): void {
    // Screen Recording has no JS-level "request" (see usePermission's doc) --
    // a 'not-determined' status is left alone so the native helper's own
    // CGRequestScreenCaptureAccess() raises the real OS prompt right here,
    // in context. Only a status macOS has already settled as denied is
    // worth short-circuiting before wasting a doomed capture attempt.
    if (
      isLikelyMac &&
      (screenPermission.status === 'denied' || screenPermission.status === 'restricted')
    ) {
      setError({
        message: 'Screen Recording permission is required.',
        openSettings: screenPermission.openSettings,
        settingsLabel: 'Open System Settings, then fully quit and reopen benpocket'
      });
      screenPermission.openSettings();
      return;
    }
    setError(null);

    // Checked up front, before counting down, so a doomed attempt doesn't
    // waste the user's chosen countdown -- the actual `requestStart` still
    // only fires once the countdown (if any) finishes.
    if (countdownSeconds > 0) {
      setMode('counting');
      setCountdownRemaining(countdownSeconds);
      countdownIntervalRef.current = setInterval(() => {
        setCountdownRemaining((remaining) => {
          if (remaining === null || remaining <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            beginRecording(source, regionOverride);
            return null;
          }
          return remaining - 1;
        });
      }, 1000);
      return;
    }
    beginRecording(source, regionOverride);
  }

  function handleStart(): void {
    if (!focusedSource) return;
    startRecording(focusedSource);
  }

  // Opens the full-desktop click-to-record overlay for this tab's type
  // instead of silently auto-picking the first matching source -- see
  // source-picker-overlay-window.ts. A pick there calls requestStart
  // directly (see SourcePickerOverlayApp.tsx's confirmSelection) with the
  // current settings handed over here, rather than relaying back through
  // this (by then hidden) window to build the payload.
  async function openSourcePicker(type: CaptureTargetType): Promise<void> {
    await window.screenRecorder.recorderToolbar.openSourcePicker({
      type,
      countdownSeconds,
      audio,
      webcam,
      cursorSettings: { visible: cursorVisible, clickRippleEnabled: clickHighlight }
    });
  }

  function handleStop(): void {
    setMode('stopping');
    window.screenRecorder.recorderToolbar.requestStop();
  }

  // Fire-and-forget, no ack event wired up on either the native or IPC side
  // (see recording-helper.ts's pauseNativeRecording/resumeNativeRecording) --
  // optimistic UI, same as `cancel()` elsewhere in this file.
  function handlePause(): void {
    void window.screenRecorder.nativeRecording.pause();
    pauseStartedAtRef.current = Date.now();
    setMode('paused');
  }

  function handleResume(): void {
    void window.screenRecorder.nativeRecording.resume();
    if (pauseStartedAtRef.current !== null) {
      pausedDurationRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
    setMode('recording');
  }

  // No native "abort without finalizing" exists (see useRecordingController's
  // stopAndDiscard) -- this is a real stop-then-start round trip under the
  // hood, so the toolbar shows a "Restarting..." beat rather than an instant
  // reset.
  function handleRestart(): void {
    setMode('restarting');
    window.screenRecorder.recorderToolbar.requestRestart();
  }

  // Destructive and irreversible (no undo, see stopAndDiscard) -- needs a
  // confirm step. First click arms it for 3s; a second click within that
  // window is the real delete. No room for a modal in a pill this size, so
  // this mirrors "click again to confirm" patterns rather than adding one.
  function handleDeleteClick(): void {
    if (!deleteArmed) {
      setDeleteArmed(true);
      deleteArmTimeoutRef.current = setTimeout(() => setDeleteArmed(false), 3000);
      return;
    }
    if (deleteArmTimeoutRef.current) clearTimeout(deleteArmTimeoutRef.current);
    setDeleteArmed(false);
    window.screenRecorder.recorderToolbar.requestDelete();
  }

  // Requests Mic/Camera access right at the click that turns each on --
  // already-granted short-circuits synchronously so the toggle doesn't lag
  // behind an unnecessary IPC round trip; not-yet-granted raises the real OS
  // prompt in context, and only opens Settings if that's actually refused.
  async function toggleMic(): Promise<void> {
    if (audio.microphoneEnabled || micPermission.status === 'granted') {
      setAudio((a) => ({ ...a, microphoneEnabled: !a.microphoneEnabled }));
      return;
    }
    if (await micPermission.ensure()) {
      setAudio((a) => ({ ...a, microphoneEnabled: true }));
    } else {
      setError({
        message: 'Microphone access is required.',
        openSettings: micPermission.openSettings
      });
      micPermission.openSettings();
    }
  }

  async function toggleWebcam(nextEnabled: boolean): Promise<void> {
    if (!nextEnabled || cameraPermission.status === 'granted') {
      setWebcam((w) => ({ ...w, enabled: nextEnabled }));
      return;
    }
    if (await cameraPermission.ensure()) {
      setWebcam((w) => ({ ...w, enabled: true }));
    } else {
      setError({
        message: 'Camera access is required.',
        openSettings: cameraPermission.openSettings
      });
      cameraPermission.openSettings();
    }
  }

  if (mode === 'counting') {
    return (
      <div className="relative flex h-full items-end justify-center pb-4">
        <div className="absolute inset-0" onMouseEnter={disablePointerEvents} />
        <div
          ref={pillRef}
          onMouseEnter={enablePointerEvents}
          className={cn(
            DRAG,
            'flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur'
          )}
        >
          <span className="font-mono text-4xl font-semibold text-white">{countdownRemaining}</span>
          <button
            onClick={cancelCountdown}
            className={cn(NO_DRAG, 'text-[10px] text-white/50 hover:text-white')}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'recording' || mode === 'paused' || mode === 'restarting' || mode === 'stopping') {
    const isPaused = mode === 'paused';
    const busy = mode === 'stopping' || mode === 'restarting';
    return (
      <div className="relative flex h-full items-end justify-center pb-4">
        {/* Dead-space overlay: everything in this (fixed-size) window that
            isn't the pill below. Sits behind it in stacking order, so the
            pill's own onMouseEnter -- not this -- wins hit-testing over its
            footprint; this only ever gets entered from genuinely empty
            space. No onMouseLeave anywhere in this file, deliberately --
            see the pill's onMouseEnter comment below. */}
        <div className="absolute inset-0" onMouseEnter={disablePointerEvents} />
        <div
          ref={pillRef}
          onMouseEnter={enablePointerEvents}
          className={cn(
            DRAG,
            'flex items-center gap-4 rounded-full border border-white/10 bg-zinc-900/95 px-5 py-3 shadow-2xl backdrop-blur'
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn('h-2.5 w-2.5 rounded-full bg-red-500', !isPaused && 'animate-pulse')}
            />
            <span className="font-mono text-sm text-white">{formatElapsed(elapsedSeconds)}</span>
          </div>

          <Tooltip.Provider delay={200} closeDelay={0}>
            <div className="flex items-center gap-3 border-l border-white/10 pl-4">
              <Tooltip.Root>
                <Tooltip.Trigger
                  onClick={handleStop}
                  disabled={busy}
                  className={cn(
                    NO_DRAG,
                    'flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-50'
                  )}
                >
                  {mode === 'stopping' ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Square size={13} fill="currentColor" />
                  )}
                </Tooltip.Trigger>
                <Tooltip.Content side="top" className="border-white/10 bg-zinc-900 text-white">
                  {mode === 'stopping' ? 'Finishing…' : 'Finish'}
                </Tooltip.Content>
              </Tooltip.Root>

              {/* Only the native helper path supports pause/resume -- silently
                  doing nothing on the legacy path would be worse than not
                  offering it at all, see nativeRecording.pause()'s doc. */}
              {nativeActive && (
                <Tooltip.Root>
                  <Tooltip.Trigger
                    onClick={isPaused ? handleResume : handlePause}
                    disabled={busy}
                    className={cn(
                      NO_DRAG,
                      'flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-50'
                    )}
                  >
                    {isPaused ? <Play size={13} /> : <Pause size={13} />}
                  </Tooltip.Trigger>
                  <Tooltip.Content side="top" className="border-white/10 bg-zinc-900 text-white">
                    {isPaused ? 'Resume' : 'Pause'}
                  </Tooltip.Content>
                </Tooltip.Root>
              )}

              <Tooltip.Root>
                <Tooltip.Trigger
                  onClick={handleRestart}
                  disabled={busy}
                  className={cn(
                    NO_DRAG,
                    'flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-50'
                  )}
                >
                  <RotateCcw size={13} />
                </Tooltip.Trigger>
                <Tooltip.Content side="top" className="border-white/10 bg-zinc-900 text-white">
                  {mode === 'restarting' ? 'Restarting…' : 'Restart'}
                </Tooltip.Content>
              </Tooltip.Root>

              <Tooltip.Root>
                <Tooltip.Trigger
                  onClick={handleDeleteClick}
                  disabled={busy}
                  className={cn(
                    NO_DRAG,
                    'flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-50',
                    deleteArmed
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  )}
                >
                  <Trash2 size={13} />
                </Tooltip.Trigger>
                <Tooltip.Content side="top" className="border-white/10 bg-zinc-900 text-white">
                  {deleteArmed ? 'Confirm?' : 'Delete'}
                </Tooltip.Content>
              </Tooltip.Root>
            </div>
          </Tooltip.Provider>
        </div>
      </div>
    );
  }

  if (!focusedSource) {
    // Still waiting on the one capture-sources fetch this window itself
    // needs (see the effect above) -- show something immediately rather
    // than a blank always-on-top window while it resolves. Once loaded with
    // genuinely nothing to focus (no sources at all), falls through to null.
    if (!sourcesLoaded) {
      return (
        <div className="relative flex h-full items-end justify-center pb-4">
          <div className="absolute inset-0" onMouseEnter={disablePointerEvents} />
          <div
            ref={pillRef}
            onMouseEnter={enablePointerEvents}
            className={cn(
              DRAG,
              'flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/95 px-4 py-2.5 shadow-2xl backdrop-blur'
            )}
          >
            <Loader2 size={14} className="animate-spin text-white/70" />
            <span className="text-[12px] text-white/70">Loading…</span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-end gap-2 pb-4">
      {/* See the recording-mode return above for why this has no onMouseLeave.
          Suppressed while a popover is open (see openPopover) -- Camera/Device
          popovers render outside the pill's own footprint, so without this
          guard the cursor crossing into one from the pill would re-trigger
          this and the window would go click-through with nothing left open
          to recover it. */}
      <div
        className="absolute inset-0"
        onMouseEnter={() => {
          if (!openPopover) disablePointerEvents();
        }}
      />
      <Tooltip.Provider delay={200} closeDelay={0}>
        <div
          ref={pillRef}
          onMouseEnter={enablePointerEvents}
          className={cn(
            DRAG,
            'flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur'
          )}
        >
          {/* Purely decorative -- stays a drag handle, unlike everything else in the bar. */}
          <GripVertical size={13} className="mx-1 shrink-0 text-white/25" />

          <Tooltip.Root>
            <Tooltip.Trigger
              onClick={() => window.screenRecorder.recorderToolbar.cancel()}
              className={cn(
                NO_DRAG,
                'flex h-7 w-7 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white'
              )}
            >
              <X size={14} />
            </Tooltip.Trigger>
            <Tooltip.Content side="top" className="border-white/10 bg-zinc-900 text-white">
              Cancel (Esc)
            </Tooltip.Content>
          </Tooltip.Root>

          <div className="ml-1 flex items-center gap-1 border-r border-white/10 pr-1.5">
            {TABS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => {
                  setActiveTab(type);
                  setSelectedDevice(null);
                  void openSourcePicker(type);
                }}
                className={cn(
                  NO_DRAG,
                  'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px]',
                  activeTab === type
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}

            <Tooltip.Root>
              <Tooltip.Trigger
                onClick={pickArea}
                className={cn(
                  NO_DRAG,
                  'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px]',
                  cropRegion
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                )}
              >
                <Crop size={15} />
                {cropRegion
                  ? `${Math.round(cropRegion.rect.width)}×${Math.round(cropRegion.rect.height)}`
                  : 'Area'}
              </Tooltip.Trigger>
              <Tooltip.Content side="top" className="border-white/10 bg-zinc-900 text-white">
                Drag-select a region of a display to record
              </Tooltip.Content>
            </Tooltip.Root>

            <Popover.Root
              open={openPopover === 'device'}
              onOpenChange={(open) => {
                setOpenPopover(open ? 'device' : null);
                if (open) enablePointerEvents();
              }}
            >
              <Popover.Trigger
                title="Record a booted iOS Simulator or Android Emulator"
                className={cn(
                  NO_DRAG,
                  'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px]',
                  selectedDevice
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                )}
              >
                <Smartphone size={15} />
                {selectedDevice === 'simulator'
                  ? 'Simulator'
                  : selectedDevice === 'emulator'
                    ? 'Emulator'
                    : 'Device'}
              </Popover.Trigger>

              <Popover.Content
                side="top"
                align="start"
                onMouseEnter={enablePointerEvents}
                className={cn(NO_DRAG, 'w-48 border-white/10 bg-zinc-900 p-1.5 text-white')}
              >
                <button
                  onClick={() => pickDevice('simulator', simulatorSource)}
                  disabled={!simulatorSource}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Simulator
                  <span className="text-[10px] text-white/40">
                    {simulatorSource ? bootedSimulatorName : 'None booted'}
                  </span>
                </button>
                <button
                  onClick={() => pickDevice('emulator', emulatorSource)}
                  disabled={!emulatorSource}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Emulator
                  <span className="text-[10px] text-white/40">
                    {emulatorSource ? emulatorSource.name : 'None running'}
                  </span>
                </button>
              </Popover.Content>
            </Popover.Root>
          </div>

          <div className="flex items-center gap-1 border-r border-white/10 px-1.5">
            <Popover.Root
              open={openPopover === 'camera'}
              onOpenChange={(open) => {
                setOpenPopover(open ? 'camera' : null);
                if (open) enablePointerEvents();
              }}
            >
              <Popover.Trigger
                className={cn(
                  NO_DRAG,
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px]',
                  webcam.enabled
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                )}
              >
                {webcam.enabled ? <Video size={14} /> : <VideoOff size={14} />}
                {webcam.enabled ? 'Camera on' : 'Camera off'}
              </Popover.Trigger>

              <Popover.Content
                side="top"
                align="start"
                onMouseEnter={enablePointerEvents}
                className={cn(NO_DRAG, 'w-48 border-white/10 bg-zinc-900 p-3 text-white')}
              >
                <label className="mb-2 flex items-center gap-2 text-xs text-white/80">
                  <input
                    type="checkbox"
                    checked={webcam.enabled}
                    onChange={(e) => void toggleWebcam(e.target.checked)}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  Show webcam
                </label>
                {webcam.enabled && (
                  <div className="flex flex-col gap-2">
                    <video
                      ref={cameraPreviewRef}
                      autoPlay
                      muted
                      playsInline
                      className={cn(
                        'h-24 w-full rounded-lg bg-black object-cover',
                        webcam.mirrored && 'scale-x-[-1]'
                      )}
                    />
                    {cameraDevices.length > 1 && (
                      <select
                        value={webcam.deviceId ?? ''}
                        onChange={(e) =>
                          setWebcam((w) => ({ ...w, deviceId: e.target.value || undefined }))
                        }
                        className="w-full rounded-lg border border-white/15 bg-transparent px-2 py-1 text-[11px] text-white/80"
                      >
                        {cameraDevices.map((device, index) => (
                          <option
                            key={device.deviceId}
                            value={device.deviceId}
                            className="bg-zinc-900"
                          >
                            {device.label || `Camera ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="grid grid-cols-3 gap-1.5">
                      {SHAPES.map(({ value, label, className }) => (
                        <button
                          key={value}
                          onClick={() => setWebcam((w) => ({ ...w, shape: value }))}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px]',
                            webcam.shape === value
                              ? 'border-accent text-accent'
                              : 'border-white/15 text-white/60'
                          )}
                        >
                          <span
                            className={cn('h-4 w-4 border border-current bg-current/20', className)}
                          />
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-white/80">
                      <input
                        type="checkbox"
                        checked={webcam.mirrored}
                        onChange={(e) => setWebcam((w) => ({ ...w, mirrored: e.target.checked }))}
                        className="h-3.5 w-3.5 accent-accent"
                      />
                      Mirror
                    </label>
                  </div>
                )}
              </Popover.Content>
            </Popover.Root>
          </div>

          <div className="flex items-center gap-1 border-r border-white/10 px-1.5">
            <Popover.Root
              open={openPopover === 'mic'}
              onOpenChange={(open) => {
                setOpenPopover(open ? 'mic' : null);
                if (open) enablePointerEvents();
              }}
            >
              <Popover.Trigger
                className={cn(
                  NO_DRAG,
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px]',
                  audio.microphoneEnabled
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                )}
              >
                {audio.microphoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                <span className="max-w-20 truncate">
                  {audio.microphoneEnabled ? (micDeviceLabel ?? 'Mic') : 'Mic'}
                </span>
                {audio.microphoneEnabled && (
                  <span className="h-3 w-6 overflow-hidden rounded-full bg-white/10">
                    <span
                      ref={micLevelBarRef}
                      className="block h-full w-full origin-left scale-x-0 rounded-full bg-accent"
                    />
                  </span>
                )}
              </Popover.Trigger>

              <Popover.Content
                side="top"
                align="start"
                onMouseEnter={enablePointerEvents}
                className={cn(NO_DRAG, 'w-48 border-white/10 bg-zinc-900 p-3 text-white')}
              >
                <label className="mb-2 flex items-center gap-2 text-xs text-white/80">
                  <input
                    type="checkbox"
                    checked={audio.microphoneEnabled}
                    onChange={() => void toggleMic()}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  Enable microphone
                </label>
                {audio.microphoneEnabled && micDevices.length > 1 && (
                  <select
                    value={audio.microphoneDeviceId ?? ''}
                    onChange={(e) => {
                      const deviceId = e.target.value || undefined;
                      const device = micDevices.find((d) => d.deviceId === deviceId);
                      setAudio((a) => ({
                        ...a,
                        microphoneDeviceId: deviceId,
                        microphoneDeviceName: device?.label
                      }));
                    }}
                    className="w-full rounded-lg border border-white/15 bg-transparent px-2 py-1 text-[11px] text-white/80"
                  >
                    {micDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId} className="bg-zinc-900">
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </Popover.Content>
            </Popover.Root>
          </div>

          <Tooltip.Root>
            <Tooltip.Trigger
              onClick={() => setAudio((a) => ({ ...a, systemAudioEnabled: !a.systemAudioEnabled }))}
              className={cn(
                NO_DRAG,
                'flex items-center rounded-full border-r border-white/10 px-2.5 py-1.5 pr-4 text-[11px]',
                audio.systemAudioEnabled ? 'text-white' : 'text-white/50 hover:text-white/80'
              )}
            >
              {audio.systemAudioEnabled ? 'System audio' : 'No system audio'}
            </Tooltip.Trigger>
            {audio.systemAudioEnabled && isLikelyMac && (
              <Tooltip.Content
                side="top"
                className="max-w-48 border-white/10 bg-zinc-900 text-white"
              >
                Unreliable on macOS without a virtual audio driver -- this may record silence.
              </Tooltip.Content>
            )}
          </Tooltip.Root>

          <Button
            onClick={handleStart}
            disabled={mode === 'starting'}
            className={cn(
              NO_DRAG,
              'ml-1 flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium disabled:opacity-60'
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            {mode === 'starting' ? 'Starting...' : 'Record'}
          </Button>
        </div>
      </Tooltip.Provider>

      {error && (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-zinc-900/95 px-4 py-2.5 text-center shadow-2xl backdrop-blur">
          <p className="text-xs text-red-400">{error.message}</p>
          {error.openSettings && (
            <button
              onClick={error.openSettings}
              className="text-[11px] font-medium text-accent underline-offset-2 hover:underline"
            >
              {error.settingsLabel ?? 'Open System Settings'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
