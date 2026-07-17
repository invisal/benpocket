import { useEffect, useMemo, useState, type JSX } from 'react';
import {
  AppWindow,
  Crop,
  GripVertical,
  Mic,
  MicOff,
  Monitor,
  Smartphone,
  Square,
  Video,
  VideoOff,
  X
} from 'lucide-react';
import { cn } from 'cnfast';
import { Popover } from '@renderer/components/ui/Popover';
import type {
  AudioInputOptions,
  CaptureSource,
  CaptureTargetType,
  WebcamOptions
} from '@screen-recorder/types/recording';
import type { CaptureRegionSelection } from '@shared/capture-region';
import type { FocusToolbarOpenPayload, FocusToolbarRecordingResult } from '@shared/focus-toolbar';

const TABS: { type: CaptureTargetType; label: string; icon: typeof Monitor }[] = [
  { type: 'screen', label: 'Display', icon: Monitor },
  { type: 'window', label: 'Window', icon: AppWindow }
];

const DEFAULT_WEBCAM: WebcamOptions = {
  enabled: false,
  shape: 'circle',
  mirrored: true,
  position: { x: 24, y: 24 },
  size: 180
};

function parseInit(): FocusToolbarOpenPayload | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('init');
    return raw ? (JSON.parse(raw) as FocusToolbarOpenPayload) : null;
  } catch {
    return null;
  }
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

type Mode = 'setup' | 'starting' | 'recording' | 'stopping';

// The window is frameless (see focus-toolbar-window.ts's `movable: true`),
// so dragging has to be opted into via CSS rather than a native titlebar.
// `drag` goes on the pill's own background; every interactive element
// inside needs `no-drag` or Chromium swallows its clicks as window-drag
// gestures instead. Tailwind has no built-in utility for this property, so
// these use arbitrary-value syntax.
const DRAG = '[-webkit-app-region:drag]';
const NO_DRAG = '[-webkit-app-region:no-drag]';

/**
 * The floating, always-on-top control bar shown while the main Craftbox
 * window is hidden (see main/screen-recorder/windows/focus-toolbar-window.ts)
 * so the user sees their actual desktop/window instead of a copy rendered
 * inside the app. This is a fully separate renderer process from the main
 * window -- it keeps its own local copy of audio/webcam settings (seeded
 * from the `init` query param) and only ever hands the *final* choice back
 * across the IPC boundary as plain data; nothing here shares store identity
 * with the main window.
 */
export function FocusToolbarApp(): JSX.Element | null {
  const init = useMemo(() => parseInit(), []);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(init?.sourceId ?? null);
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
  const [error, setError] = useState<string | null>(null);
  const [openPopover, setOpenPopover] = useState<'camera' | 'device' | null>(null);
  // Which device kind the user picked via the Device popover below, purely
  // to highlight the right label on the button -- the actual selection lives
  // in sourceId/cropRegion like every other pick.
  const [selectedDevice, setSelectedDevice] = useState<'simulator' | 'emulator' | null>(null);
  const [bootedSimulatorName, setBootedSimulatorName] = useState<string | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    window.screenRecorder.recording
      .getCaptureSources()
      .then(setSources)
      .catch(() => setSources([]));
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
      window.screenRecorder.focusToolbar.onRecordingResult(
        (result: FocusToolbarRecordingResult) => {
          if (result.ok) {
            setMode('recording');
            setRecordingStartedAt(Date.now());
            setError(null);
          } else {
            setMode('setup');
            setError(result.error ?? 'Failed to start recording.');
          }
        }
      ),
    []
  );

  // A pick from the Display/Window click-to-record overlay (see
  // source-picker-overlay-window.ts) skips the toolbar's own Record button
  // entirely -- clicking a display/window panel there both selects it and
  // starts recording immediately, same as the native macOS window-select
  // flow. `sources`/`cropRegion`/`audio`/`webcam` are all read inside
  // startRecording via closure, so this has to re-subscribe whenever any of
  // them change or it'd start with stale config.
  useEffect(
    () =>
      window.screenRecorder.focusToolbar.onSourcePicked((sourceId) => {
        const source = sources.find((s) => s.id === sourceId);
        if (!source) return;
        setSourceId(source.id);
        setCropRegion(null);
        setActiveTab(source.type);
        setSelectedDevice(null);
        startRecording(source);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sources, cropRegion, audio, webcam]
  );

  useEffect(() => {
    if (mode !== 'recording' || recordingStartedAt === null) return;
    const id = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - recordingStartedAt) / 1000)),
      250
    );
    return () => clearInterval(id);
  }, [mode, recordingStartedAt]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // Only cancels pre-recording setup -- an active recording only stops
      // via the explicit Stop button, same as the native recorder.
      if (event.key === 'Escape' && mode === 'setup') window.screenRecorder.focusToolbar.cancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const focusedSource = sources.find((s) => s.id === sourceId) ?? null;

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

  // Drag-select a sub-rectangle of a display to record instead of the whole
  // thing. Reuses the same fullscreen overlay window Screen Capture's region
  // screenshot flow uses (main/screen-recorder/windows/region-select-window.ts)
  // -- it's generic ScreenRect-in/CaptureRegionSelection-out plumbing with no
  // screenshot-specific coupling. Hides this window first (mainOnly so it
  // doesn't take the whole app down) so the overlay isn't fighting our own
  // always-on-top pill for the topmost spot.
  async function pickArea(): Promise<void> {
    const screenSource = sources.find((s) => s.type === 'screen');
    if (!screenSource) return;
    await window.screenRecorder.window.hide({ mainOnly: true });
    try {
      const selection = await window.screenRecorder.screenshot.selectRegion();
      if (selection) {
        setSourceId(screenSource.id);
        setCropRegion(selection);
        // Area has its own highlight (driven by cropRegion) -- clear
        // Display/Window's and Device's so only one control ever reads as active.
        setActiveTab(null);
        setSelectedDevice(null);
        setOpenPopover(null);
      }
    } finally {
      await window.screenRecorder.window.restore({ focus: true });
    }
  }

  function startRecording(source: CaptureSource): void {
    setMode('starting');
    setError(null);
    // The drag-selected Area rect is the most specific target available;
    // otherwise fall back to the source's own display bounds (only ever
    // resolved for a 'screen' source, or a 'window' source with a known
    // owner -- currently just the Simulator -- see CaptureSource.displayBounds).
    // A generic window with no bounds just leaves this undefined, and the
    // toolbar stays wherever it already is.
    const targetBounds = cropRegion?.rect ?? source.displayBounds;
    window.screenRecorder.focusToolbar.requestStart({
      sourceId: source.id,
      audio,
      webcam,
      cropRegion: cropRegion ?? undefined,
      targetBounds
    });
  }

  function handleStart(): void {
    if (!focusedSource) return;
    startRecording(focusedSource);
  }

  // Opens the full-desktop click-to-record overlay for this tab's type
  // instead of silently auto-picking the first matching source -- see
  // source-picker-overlay-window.ts. A pick there arrives via
  // onSourcePicked above and starts recording immediately.
  async function openSourcePicker(type: CaptureTargetType): Promise<void> {
    await window.screenRecorder.focusToolbar.openSourcePicker({ type });
  }

  function handleStop(): void {
    setMode('stopping');
    window.screenRecorder.focusToolbar.requestStop();
  }

  if (mode === 'recording' || mode === 'stopping') {
    return (
      <div className="flex h-full items-end justify-center pb-4">
        <div
          className={cn(
            DRAG,
            'flex items-center gap-3 rounded-full border border-white/10 bg-zinc-900/95 py-2.5 pr-2.5 pl-4 shadow-2xl backdrop-blur'
          )}
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-sm text-white">{formatElapsed(elapsedSeconds)}</span>
          <button
            onClick={handleStop}
            disabled={mode === 'stopping'}
            className={cn(
              NO_DRAG,
              'flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-60'
            )}
          >
            <Square size={11} fill="currentColor" />
            {mode === 'stopping' ? 'Stopping...' : 'Stop'}
          </button>
        </div>
      </div>
    );
  }

  if (!focusedSource) return null;

  return (
    <div className="flex h-full flex-col items-center justify-end gap-2 pb-4">
      <div
        className={cn(
          DRAG,
          'flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur'
        )}
      >
        {/* Purely decorative -- stays a drag handle, unlike everything else in the bar. */}
        <GripVertical size={13} className="mx-1 shrink-0 text-white/25" />

        <button
          onClick={() => window.screenRecorder.focusToolbar.cancel()}
          title="Cancel (Esc)"
          className={cn(
            NO_DRAG,
            'flex h-7 w-7 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white'
          )}
        >
          <X size={14} />
        </button>

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

          <button
            onClick={pickArea}
            title="Drag-select a region of a display to record"
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
          </button>

          <Popover.Root
            open={openPopover === 'device'}
            onOpenChange={(open) => setOpenPopover(open ? 'device' : null)}
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
            onOpenChange={(open) => setOpenPopover(open ? 'camera' : null)}
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
              className={cn(NO_DRAG, 'w-48 border-white/10 bg-zinc-900 p-3 text-white')}
            >
              <label className="mb-2 flex items-center gap-2 text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={webcam.enabled}
                  onChange={(e) => setWebcam((w) => ({ ...w, enabled: e.target.checked }))}
                  className="h-3.5 w-3.5 accent-accent"
                />
                Show webcam
              </label>
              {webcam.enabled && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['circle', 'rounded-square', 'square'] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => setWebcam((w) => ({ ...w, shape: option }))}
                        className={cn(
                          'truncate rounded-lg border px-2 py-1 text-[11px]',
                          webcam.shape === option
                            ? 'border-accent text-accent'
                            : 'border-white/15 text-white/60'
                        )}
                      >
                        {option}
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

        <button
          onClick={() => setAudio((a) => ({ ...a, microphoneEnabled: !a.microphoneEnabled }))}
          className={cn(
            NO_DRAG,
            'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px]',
            audio.microphoneEnabled
              ? 'bg-white/15 text-white'
              : 'text-white/50 hover:bg-white/10 hover:text-white/80'
          )}
        >
          {audio.microphoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
          Mic
        </button>

        <button
          onClick={() => setAudio((a) => ({ ...a, systemAudioEnabled: !a.systemAudioEnabled }))}
          className={cn(
            NO_DRAG,
            'flex items-center rounded-full border-r border-white/10 px-2.5 py-1.5 pr-4 text-[11px]',
            audio.systemAudioEnabled ? 'text-white' : 'text-white/50 hover:text-white/80'
          )}
        >
          {audio.systemAudioEnabled ? 'System audio' : 'No system audio'}
        </button>

        <button
          onClick={handleStart}
          disabled={mode === 'starting'}
          className={cn(
            NO_DRAG,
            'ml-1 flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[12px] font-medium text-black disabled:opacity-60'
          )}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
          {mode === 'starting' ? 'Starting...' : 'Record'}
        </button>
      </div>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
