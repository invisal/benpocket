import { useEffect, useRef, useState, type JSX } from 'react';
import { AppWindow, Crop, GripVertical, Monitor, Timer, X } from 'lucide-react';
import { cn } from 'cnfast';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useSyncDocumentTheme } from '@renderer/store/theme.store';
import type { CaptureSource, CaptureTargetType } from '@screen-recorder/types/recording';
import { pickDefaultCaptureSource } from '@screen-recorder/features/recording/lib/pick-default-capture-source';
import type {
  CaptureToolbarCapturePayload,
  CaptureToolbarOpenPayload
} from '@shared/capture-toolbar';
import {
  CAPTURE_DELAY_OPTIONS,
  captureDelayLabel,
  normalizeCaptureDelay,
  runCaptureCountdown,
  type CaptureDelaySetting
} from '@shared/capture-delay';
import { findScreenSourceForRegion } from '../lib/capture-frame';

const TABS: { type: CaptureTargetType; label: string; icon: typeof Monitor }[] = [
  { type: 'screen', label: 'Display', icon: Monitor },
  { type: 'window', label: 'Window', icon: AppWindow }
];

const DRAG = '[-webkit-app-region:drag]';
const NO_DRAG = '[-webkit-app-region:no-drag]';

const DELAY_CHIPS: CaptureDelaySetting[] = [0, ...CAPTURE_DELAY_OPTIONS];

function parseInit(): CaptureToolbarOpenPayload {
  try {
    const raw = new URLSearchParams(window.location.search).get('init');
    const parsed = raw ? (JSON.parse(raw) as CaptureToolbarOpenPayload) : null;
    return { delaySeconds: normalizeCaptureDelay(parsed?.delaySeconds) };
  } catch {
    return { delaySeconds: 0 };
  }
}

export function CaptureToolbarApp(): JSX.Element {
  useSyncDocumentTheme();
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [activeTab, setActiveTab] = useState<CaptureTargetType | null>(null);
  const [delaySeconds, setDelaySeconds] = useState<CaptureDelaySetting>(
    () => parseInit().delaySeconds
  );
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const delayRef = useRef(delaySeconds);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    delayRef.current = delaySeconds;
  });

  useEffect(() => {
    window.screenRecorder.recording
      .getCaptureSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  function cancelCountdown(): void {
    abortRef.current?.abort();
    abortRef.current = null;
    setCountdownRemaining(null);
  }

  async function waitOnPill(delay: CaptureDelaySetting): Promise<boolean> {
    cancelCountdown();
    if (delay <= 0) return true;
    const controller = new AbortController();
    abortRef.current = controller;
    const ok = await runCaptureCountdown(delay, setCountdownRemaining, {
      signal: controller.signal
    });
    if (abortRef.current === controller) abortRef.current = null;
    if (!ok) return false;
    setCountdownRemaining(null);
    return true;
  }

  async function captureAfterDelay(payload: CaptureToolbarCapturePayload): Promise<void> {
    const delay = normalizeCaptureDelay(payload.delaySeconds ?? delayRef.current);
    const ok = await waitOnPill(delay);
    if (!ok) return;
    window.screenRecorder.captureToolbar.requestCapture({
      sourceId: payload.sourceId,
      cropRegion: payload.cropRegion
    });
  }

  useEffect(() => {
    return window.screenRecorder.captureToolbar.onCountdown((payload) => {
      void captureAfterDelay(payload);
    });
    // ponytail: subscribe once; delay/abort live in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      if (abortRef.current) {
        cancelCountdown();
        return;
      }
      window.screenRecorder.captureToolbar.cancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function openSourcePicker(type: CaptureTargetType): Promise<void> {
    await window.screenRecorder.captureToolbar.openSourcePicker({
      type,
      delaySeconds: delayRef.current
    });
  }

  async function pickArea(): Promise<void> {
    const list =
      sources.length > 0 ? sources : await window.screenRecorder.recording.getCaptureSources();
    const anyScreenSource = list.find((s) => s.type === 'screen') ?? pickDefaultCaptureSource(list);
    if (!anyScreenSource) return;
    const ok = await waitOnPill(delayRef.current);
    if (!ok) return;
    const bounds = await window.screenRecorder.captureToolbar.getCurrentDisplayBounds();
    await window.screenRecorder.window.hide({ mainOnly: true });
    let captured = false;
    try {
      const selection = await window.screenRecorder.screenshot.selectRegion({
        bounds: bounds ?? undefined
      });
      if (!selection) return;
      const screenSource = findScreenSourceForRegion(list, selection) ?? anyScreenSource;
      captured = true;
      window.screenRecorder.captureToolbar.requestCapture({
        sourceId: screenSource.id,
        cropRegion: selection
      });
    } finally {
      if (!captured) await window.screenRecorder.window.restore({ focus: false });
    }
  }

  const counting = countdownRemaining !== null;

  useEffect(() => {
    if (!counting) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [counting]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Tooltip.Provider delay={200} closeDelay={0}>
        <div
          className={cn(
            DRAG,
            'flex items-center gap-1 rounded-full border border-border bg-surface/95 p-1.5 shadow-2xl backdrop-blur'
          )}
        >
          <GripVertical size={13} className="mx-1 shrink-0 text-muted-foreground/50" />

          <Tooltip.Root disabled={counting}>
            <Tooltip.Trigger
              type="button"
              tabIndex={counting ? -1 : undefined}
              onClick={() => {
                if (counting) cancelCountdown();
                else window.screenRecorder.captureToolbar.cancel();
              }}
              className={cn(
                NO_DRAG,
                'flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground'
              )}
            >
              <X size={14} />
            </Tooltip.Trigger>
            <Tooltip.Content side="top">Cancel (Esc)</Tooltip.Content>
          </Tooltip.Root>

          {counting ? (
            <span className="min-w-16 px-3 text-center font-mono text-xl font-semibold text-foreground">
              {countdownRemaining}
            </span>
          ) : (
            <>
              <div className="ml-1 flex items-center gap-1">
                {TABS.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setActiveTab(type);
                      void openSourcePicker(type);
                    }}
                    className={cn(
                      NO_DRAG,
                      'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px]',
                      activeTab === type
                        ? 'bg-surface-3 text-strong'
                        : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                    )}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(null);
                    void pickArea();
                  }}
                  className={cn(
                    NO_DRAG,
                    'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                  )}
                >
                  <Crop size={15} />
                  Area
                </button>
              </div>

              <div className="ml-1 flex items-center gap-0.5 border-l border-border pl-1.5">
                <Timer size={13} className="mx-1 shrink-0 text-muted-foreground" />
                {DELAY_CHIPS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    title={
                      seconds === 0
                        ? 'Capture immediately'
                        : `Wait ${seconds} seconds before capture`
                    }
                    onClick={() => {
                      setDelaySeconds(seconds);
                      window.screenRecorder.captureToolbar.setDelay(seconds);
                    }}
                    className={cn(
                      NO_DRAG,
                      'rounded-full px-2 py-1 text-[10px]',
                      delaySeconds === seconds
                        ? 'bg-surface-3 text-strong'
                        : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                    )}
                  >
                    {captureDelayLabel(seconds)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Tooltip.Provider>
    </div>
  );
}
