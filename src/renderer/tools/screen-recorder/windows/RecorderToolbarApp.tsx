import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { GripVertical, Loader2, X } from 'lucide-react';
import { cn } from 'cnfast';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useSyncDocumentTheme } from '@renderer/store/theme.store';
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
import { isPermissionError } from '../lib/is-permission-error';
import { DRAG, NO_DRAG, disablePointerEvents, enablePointerEvents } from '../lib/pointer-events';
import type { Mode, ToolbarError } from '../types/toolbar';
import { Button } from '@renderer/components/ui/Button';
import { RecorderToolbarIconButton } from '../components/RecorderToolbarIconButton';
import { RecorderToolbarCountdown } from '../components/RecorderToolbarCountdown';
import { RecorderToolbarRecordingControls } from '../components/RecorderToolbarRecordingControls';
import { RecorderToolbarSourceControls } from '../components/RecorderToolbarSourceControls';
import { RecorderToolbarCameraPopover } from '../components/RecorderToolbarCameraPopover';
import { RecorderToolbarMicPopover } from '../components/RecorderToolbarMicPopover';
import { RecorderToolbarErrorBanner } from '../components/RecorderToolbarErrorBanner';

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

/** Always-on-top control bar shown while the main window is hidden (see recorder-toolbar-window.ts) -- a separate renderer with its own local settings, hands the final choice back over IPC. */
export function RecorderToolbarApp(): JSX.Element | null {
  useSyncDocumentTheme();
  const init = useMemo(() => parseInit(), []);
  const screenPermission = usePermission('screen');
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
  // Null until the user clicks a tab -- avoids showing one pre-selected.
  const [activeTab, setActiveTab] = useState<CaptureTargetType | null>(null);
  const [mode, setMode] = useState<Mode>('setup');
  const [error, setError] = useState<ToolbarError | null>(null);
  const [openPopover, setOpenPopover] = useState<'camera' | 'device' | 'mic' | null>(null);
  // Only for highlighting the Device button; the real pick lives in sourceId/cropRegion.
  const [selectedDevice, setSelectedDevice] = useState<'simulator' | 'emulator' | null>(null);
  const [bootedSimulatorName, setBootedSimulatorName] = useState<string | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  // Fixed for the toolbar's lifetime -- set by the opener, never changed here.
  const cursorVisible = init?.cursorSettings.visible ?? true;
  const clickHighlight = init?.cursorSettings.clickRippleEnabled ?? false;
  const countdownSeconds = init?.countdownSeconds ?? 0;
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  // Only the native helper supports Pause/Resume; set once a recording starts.
  const [nativeActive, setNativeActive] = useState(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  function beginRecording(
    source: CaptureSource,
    regionOverride?: CaptureRegionSelection | null
  ): void {
    setMode('starting');
    const region = regionOverride !== undefined ? regionOverride : cropRegion;
    // Area rect wins if set, else the source's own display bounds (screen sources, or the Simulator window).
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

  useEffect(() => {
    window.screenRecorder.recording
      // Skip thumbnails -- not rendered here.
      .getCaptureSources({ includeThumbnails: false })
      .then((fetched) => {
        setSources(fetched);
        // Resolve the default source now that the list exists.
        setSourceId((current) => current ?? pickDefaultCaptureSource(fetched)?.id ?? null);
      })
      .catch(() => setSources([]))
      .finally(() => setSourcesLoaded(true));
  }, []);

  // Window is taller than the pill (room for popovers), so most of it is
  // transparent but still click-blocking -- start click-through; the
  // dead-space overlay and pill/popover below toggle it per mouse position.
  useEffect(() => {
    disablePointerEvents();
  }, []);

  // Booted-Simulator name, to match against window sources and light up Device's Simulator option.
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      // Cancels just the countdown, not the whole toolbar.
      if (mode === 'counting') {
        cancelCountdown();
        return;
      }
      // Only cancels setup -- an active recording stops via the Stop button only.
      if (mode === 'setup') window.screenRecorder.recorderToolbar.cancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const focusedSource = sources.find((s) => s.id === sourceId) ?? null;

  // Reports the pill's on-screen rect to recorder-toolbar-window.ts; also
  // re-measures on an interval since a reposition doesn't fire resize.
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

  // Name-matched against window titles -- no adb detection exists in this codebase.
  const simulatorSource = sources.find(
    (s) =>
      s.type === 'window' && bootedSimulatorName !== null && s.name.includes(bootedSimulatorName)
  );
  const emulatorSource = sources.find((s) => s.type === 'window' && /emulator/i.test(s.name));

  // A booted Simulator/Emulator is a single known window, so picking it both selects and highlights it directly.
  function pickDevice(kind: 'simulator' | 'emulator', source: CaptureSource | undefined): void {
    if (!source) return;
    setSourceId(source.id);
    setCropRegion(null);
    setActiveTab(null);
    setSelectedDevice(kind);
    setOpenPopover(null);
  }

  // Must resolve the display the drag actually landed on, not just any screen source, or multi-monitor recording grabs the wrong one.
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

  // Drag-select a sub-rect of a display; reuses screen-capture's region
  // overlay. Hides this window first so it doesn't fight the overlay for
  // topmost, and scopes to the toolbar's current display.
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
        // Only one of Area/Display/Window/Device should ever read as active.
        setActiveTab(null);
        setSelectedDevice(null);
        setOpenPopover(null);
        startRecording(screenSource, selection);
      }
    } finally {
      await window.screenRecorder.window.restore({ focus: true });
    }
  }

  // `regionOverride` covers pickArea calling this in the same tick as
  // setCropRegion, before the `cropRegion` state itself has updated.
  function startRecording(
    source: CaptureSource,
    regionOverride?: CaptureRegionSelection | null
  ): void {
    // Screen Recording has no JS "request" -- only short-circuit if macOS already denied it.
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

    // Checked before counting down so a doomed attempt doesn't waste the countdown.
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

  // Opens the click-to-record overlay instead of auto-picking a source; a pick there calls requestStart directly.
  async function openSourcePicker(type: CaptureTargetType): Promise<void> {
    await window.screenRecorder.recorderToolbar.openSourcePicker({
      type,
      countdownSeconds,
      audio,
      webcam,
      cursorSettings: { visible: cursorVisible, clickRippleEnabled: clickHighlight }
    });
  }

  if (mode === 'counting') {
    return (
      <RecorderToolbarCountdown
        countdownRemaining={countdownRemaining}
        onCancel={cancelCountdown}
        pillRef={pillRef}
      />
    );
  }

  if (mode === 'recording' || mode === 'paused' || mode === 'restarting' || mode === 'stopping') {
    return (
      <RecorderToolbarRecordingControls
        mode={mode}
        recordingStartedAt={recordingStartedAt}
        nativeActive={nativeActive}
        pillRef={pillRef}
        onModeChange={setMode}
      />
    );
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-end gap-2 pb-4">
      {/* No onMouseLeave (see RecordingControls); suppressed while a popover is open so it doesn't go click-through under an open popover. */}
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
            'flex items-center gap-1 rounded-full border border-border bg-surface/95 p-1.5 shadow-[0_0_28px_rgba(0,0,0,0.3)] backdrop-blur'
          )}
        >
          {/* Decorative -- stays a drag handle. */}
          <GripVertical size={13} className="mx-1 shrink-0 text-muted-foreground/50" />

          <RecorderToolbarIconButton
            icon={<X size={14} />}
            tooltip="Close (Esc)"
            onClick={() => window.screenRecorder.recorderToolbar.cancel()}
            tone="plain"
            size={7}
          />

          <RecorderToolbarSourceControls
            activeTab={activeTab}
            onSelectTab={(type) => {
              setActiveTab(type);
              setSelectedDevice(null);
              void openSourcePicker(type);
            }}
            cropRegion={cropRegion}
            onPickArea={pickArea}
            devicePopoverOpen={openPopover === 'device'}
            onDevicePopoverOpenChange={(open) => setOpenPopover(open ? 'device' : null)}
            selectedDevice={selectedDevice}
            simulatorSource={simulatorSource}
            emulatorSource={emulatorSource}
            bootedSimulatorName={bootedSimulatorName}
            onPickDevice={pickDevice}
          />

          <RecorderToolbarCameraPopover
            webcam={webcam}
            onWebcamChange={setWebcam}
            open={openPopover === 'camera'}
            onOpenChange={(open) => setOpenPopover(open ? 'camera' : null)}
            onError={setError}
          />

          <RecorderToolbarMicPopover
            audio={audio}
            onAudioChange={setAudio}
            open={openPopover === 'mic'}
            onOpenChange={(open) => setOpenPopover(open ? 'mic' : null)}
            onError={setError}
          />

          <Tooltip.Root>
            <Tooltip.Trigger
              onClick={() => setAudio((a) => ({ ...a, systemAudioEnabled: !a.systemAudioEnabled }))}
              className={cn(
                NO_DRAG,
                'flex items-center rounded-full border-r border-border px-2.5 py-1.5 pr-4 text-[11px]',
                audio.systemAudioEnabled
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {audio.systemAudioEnabled ? 'System audio' : 'No system audio'}
            </Tooltip.Trigger>
            {audio.systemAudioEnabled && isLikelyMac && (
              <Tooltip.Content side="top" className="max-w-48">
                Unreliable on macOS without a virtual audio driver -- this may record silence.
              </Tooltip.Content>
            )}
          </Tooltip.Root>

          <Button
            onClick={handleStart}
            disabled={mode === 'starting' || !focusedSource}
            className={cn(
              NO_DRAG,
              'ml-1 flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium disabled:opacity-60'
            )}
          >
            {sourcesLoaded ? (
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            ) : (
              <Loader2 size={11} className="animate-spin" />
            )}
            {mode === 'starting' ? 'Starting...' : 'Record'}
          </Button>
        </div>
      </Tooltip.Provider>

      <RecorderToolbarErrorBanner error={error} />
    </div>
  );
}
