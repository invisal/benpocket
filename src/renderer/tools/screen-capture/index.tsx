import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  CircleCheck,
  ClipboardCopy,
  Download,
  ImageUp,
  Loader2
} from 'lucide-react';
import { cn } from 'cnfast';
import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { ToolLayout } from '@renderer/components/layout/ToolLayout';
import { Button } from '@renderer/components/ui/Button';
import { Menu } from '@renderer/components/ui/Menu';
import { ScreenRecordingPermissionBanner } from '@screen-recorder/features/recording/components/ScreenRecordingPermissionBanner';
import { CAPTURE_DELAY_OPTIONS, runCaptureCountdown } from '@shared/capture-delay';
import { CaptureEditor } from './components/CaptureEditor';
import { EditorToolbar } from './components/EditorToolbar';
import { LayerPanel } from './components/LayerPanel';
import { useCaptureEditorStore } from './store/editor.store';
import { useCaptureResultStore } from './store/capture-result.store';
import { flattenImage } from './lib/flatten';
import { addImageLayerFromBlob } from './lib/image-layer';
import {
  blobToDataUrl,
  CAPTURE_EXPORT_FORMATS,
  encodeCaptureBlob,
  selectAndCaptureRegion,
  screenshotFileName,
  toPngBlob,
  type CaptureExportFormat,
  type RegionCaptureStep
} from './lib/capture-frame';
import { openCaptureToolbarFor } from './lib/open-capture-toolbar';
import { useScreenCaptureSettings } from './lib/use-screen-capture-settings';

interface Props {}

type Phase = 'idle' | 'capturing' | 'result';
type CaptureMode = 'source' | 'region';

async function copyViaRenderer(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

async function copyViaMainProcess(blob: Blob): Promise<boolean> {
  if (!window.screenRecorder) return false;

  try {
    const buffer = await blob.arrayBuffer();
    await window.screenRecorder.screenshot.copy(buffer);
    return true;
  } catch {
    return false;
  }
}

async function copyToClipboard(blob: Blob): Promise<boolean> {
  if (await copyViaRenderer(blob)) return true;
  return copyViaMainProcess(blob);
}

async function copyAfterCapture(blob: Blob): Promise<boolean> {
  if (await copyViaMainProcess(blob)) return true;
  return copyViaRenderer(blob);
}

async function flattenFromEditorState(blob: Blob): Promise<Blob> {
  const { annotations, cornerRadius, crop, background, watermark } =
    useCaptureEditorStore.getState();
  return flattenImage(blob, annotations, cornerRadius, crop, background, watermark);
}

// eslint-disable-next-line no-empty-pattern
export function ScreenCaptureMain({}: ToolComponentProps<Props>): JSX.Element {
  const usesOsPicker = window.api?.usesOsCapturePicker ?? false;
  const [phase, setPhase] = useState<Phase>('idle');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('source');
  const [captureStep, setCaptureStep] = useState<RegionCaptureStep>('picker');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [confirmed, setConfirmed] = useState<'copy' | 'save' | null>(null);
  const [busy, setBusy] = useState<'copy' | 'save' | null>(null);
  const {
    isLoading: settingsLoading,
    fields: settings,
    setFields: setSettings
  } = useScreenCaptureSettings();
  const hideApp = settings.hideApp;
  const isToolbarOpen = useCaptureResultStore((s) => s.isToolbarOpen);
  const confirmTimer = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const countdownAbortRef = useRef<AbortController | null>(null);
  /** Prevents zustand→Y echo when applying remote/local hydrate. */
  const applyingSettingsRef = useRef(false);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });

  // Profile persist store → editor zustand prefs.
  useEffect(() => {
    if (settingsLoading) return;
    applyingSettingsRef.current = true;
    useCaptureEditorStore.getState().applyPersistedPrefs({
      toolStyles: settings.toolStyles,
      penSnapShapes: settings.penSnapShapes,
      highlightSnap: settings.highlightSnap,
      highlightSquareEnds: settings.highlightSquareEnds,
      watermark: settings.watermark,
      background: settings.background,
      cornerRadiusUnits: settings.cornerRadiusUnits
    });
    applyingSettingsRef.current = false;
  }, [settingsLoading, settings]);

  // Editor zustand prefs → profile persist store.
  useEffect(() => {
    if (settingsLoading) return;
    return useCaptureEditorStore.subscribe((state, previous) => {
      if (applyingSettingsRef.current) return;
      if (
        state.toolStyles === previous.toolStyles &&
        state.penSnapShapes === previous.penSnapShapes &&
        state.highlightSnap === previous.highlightSnap &&
        state.highlightSquareEnds === previous.highlightSquareEnds &&
        state.watermark === previous.watermark &&
        state.background === previous.background &&
        state.cornerRadiusUnits === previous.cornerRadiusUnits
      ) {
        return;
      }
      setSettings({
        ...state.getPersistedPrefs(),
        hideApp: settingsRef.current.hideApp
      });
    });
  }, [settingsLoading, setSettings]);

  /** Import a pasted / opened image straight into the editor. Unlike a fresh capture, this does not auto-copy — the image likely came from the clipboard. */
  const openImage = useCallback(async (source: Blob): Promise<void> => {
    try {
      const blob = await toPngBlob(source);
      const dataUrl = await blobToDataUrl(blob);
      useCaptureEditorStore.getState().reset();
      setPreviewBlob(blob);
      setPreviewDataUrl(dataUrl);
      setPhase('result');
    } catch (err) {
      console.error('Could not open image.', err);
    }
  }, []);

  const toggleHideApp = (next: boolean): void => {
    setSettings({ hideApp: next });
  };

  const flashConfirm = (action: 'copy' | 'save'): void => {
    setConfirmed(action);
    window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirmed(null), 1500);
  };

  // Idle: paste opens a new capture. Result: paste adds an image layer
  // unless the user is typing in a field or editing text on the stage.
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'result') return;
    function onPaste(event: ClipboardEvent): void {
      const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/')
      );
      const file = item?.getAsFile();
      if (!file) return;
      if (phase === 'idle') {
        event.preventDefault();
        void openImage(file);
        return;
      }
      if (useCaptureEditorStore.getState().editingId) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      void addImageLayerFromBlob(file);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [phase, openImage]);

  const finishCapture = async (blob: Blob | null): Promise<void> => {
    if (!blob) {
      setPhase('idle');
      return;
    }
    const dataUrl = await blobToDataUrl(blob);
    useCaptureEditorStore.getState().reset();
    setPreviewBlob(blob);
    setPreviewDataUrl(dataUrl);
    setPhase('result');

    void flattenFromEditorState(blob).then((exportBlob) =>
      copyAfterCapture(exportBlob).then((copied) => {
        if (!copied) console.error('Could not copy screenshot to clipboard.');
      })
    );
  };

  const finishCaptureRef = useRef(finishCapture);
  useEffect(() => {
    finishCaptureRef.current = finishCapture;
  });

  const pendingCapture = useCaptureResultStore((s) => s.pending);
  useEffect(() => {
    if (!pendingCapture) return;
    void finishCaptureRef.current(pendingCapture).finally(() => {
      useCaptureResultStore.getState().takePending();
    });
  }, [pendingCapture]);

  const cancelCaptureCountdown = (): void => {
    countdownAbortRef.current?.abort();
    countdownAbortRef.current = null;
    setCountdownRemaining(null);
  };

  const runRegionCapture = async (delaySeconds = 0): Promise<void> => {
    if (countdownAbortRef.current) return;

    if (delaySeconds > 0) {
      const controller = new AbortController();
      countdownAbortRef.current = controller;
      const ok = await runCaptureCountdown(delaySeconds, setCountdownRemaining, {
        signal: controller.signal
      });
      if (countdownAbortRef.current === controller) countdownAbortRef.current = null;
      if (!ok) return;
      setCountdownRemaining(null);
    }

    setCaptureMode('region');
    setCaptureStep('picker');
    setPhase('capturing');
    setPreviewDataUrl(null);
    setPreviewBlob(null);

    try {
      const blob = await selectAndCaptureRegion(
        [],
        usesOsPicker,
        (step) => {
          setCaptureStep(step);
          setPhase('capturing');
        },
        { hideApp }
      );
      await finishCapture(blob);
    } catch (err) {
      setPhase('idle');
      console.error('Could not capture region.', err);
    }
  };

  useEffect(() => {
    if (!usesOsPicker) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') cancelCaptureCountdown();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      countdownAbortRef.current?.abort();
    };
  }, [usesOsPicker]);

  const handleCapture = (): void => {
    void openCaptureToolbarFor(settings.delaySeconds);
  };

  const handleCaptureAgain = (): void => {
    useCaptureEditorStore.getState().reset();
    setPhase('idle');
    setPreviewDataUrl(null);
    setPreviewBlob(null);
    setConfirmed(null);
  };

  /** Copy/Save export what's on the editor stage, not the raw capture. */
  const editedBlob = async (): Promise<Blob | null> => {
    if (!previewBlob) return null;
    return flattenFromEditorState(previewBlob);
  };

  const handleCopy = async (): Promise<void> => {
    if (busy) return;
    setBusy('copy');
    // Let the button spinner paint before main-thread flatten work.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const blob = await editedBlob();
      if (!blob) return;
      if (await copyToClipboard(blob)) {
        flashConfirm('copy');
      } else {
        console.error('Could not copy screenshot to clipboard.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async (format: CaptureExportFormat): Promise<void> => {
    if (!window.screenRecorder || busy) return;

    setBusy('save');
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const edited = await editedBlob();
      if (!edited) return;
      const preset = CAPTURE_EXPORT_FORMATS.find((f) => f.id === format)!;
      const blob = await encodeCaptureBlob(edited, format);
      const arrayBuffer = await blob.arrayBuffer();
      const filePath = await window.screenRecorder.screenshot.save(
        arrayBuffer,
        screenshotFileName(preset.ext)
      );
      if (filePath) flashConfirm('save');
    } catch (err) {
      console.error('Could not save screenshot.', err);
    } finally {
      setBusy(null);
    }
  };

  const capturingMessage =
    captureMode === 'region' && captureStep === 'processing'
      ? 'Cropping screenshot…'
      : captureMode === 'region' && captureStep === 'region'
        ? 'Drag a region on screen…'
        : captureMode === 'region' && usesOsPicker
          ? 'Choose what to capture in the system dialog…'
          : captureMode === 'region'
            ? 'Capturing selected region…'
            : 'Capturing…';

  const isCapturing = phase === 'capturing' || (pendingCapture !== null && phase !== 'result');

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface text-text-base">
      <ToolLayout.Title>{phase === 'result' ? 'Preview' : 'Screen Capture'}</ToolLayout.Title>
      {!isCapturing && (
        <header className="shrink-0 border-b border-border-dark px-6 py-4">
          {phase === 'idle' && !isCapturing ? (
            <div>
              <h1 className="text-base font-medium">Screen Capture</h1>
              <p className="mt-0.5 text-xs text-text-dim">Take a screenshot or edit an image.</p>
            </div>
          ) : (
            <div>
              <h1 className="text-base font-medium">Preview</h1>
              <p className="mt-0.5 text-xs text-text-dim">
                Annotate your screenshot, then copy or save it — or capture again.
              </p>
            </div>
          )}
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden',
            // Result phase goes edge-to-edge so the dotted editor canvas
            // fills the space between header and footer.
            phase !== 'result' && 'p-6 pb-4',
            phase === 'idle' && 'overflow-y-auto'
          )}
        >
          <ScreenRecordingPermissionBanner />

          {phase === 'idle' && !isCapturing && (
            <div className="bg-dotted flex min-h-[12rem] flex-1 flex-col items-center justify-center rounded-xl bg-surface select-none">
              {countdownRemaining !== null ? (
                <>
                  <span className="font-mono text-5xl font-semibold text-foreground">
                    {countdownRemaining}
                  </span>
                  <p className="mt-3 text-xs text-muted-foreground">Capturing in a moment…</p>
                  <Button
                    variant="secondary"
                    size="md"
                    className="mt-5"
                    onClick={cancelCaptureCountdown}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-accent">
                    <Camera size={26} />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground">Ready to capture</h2>
                  <p className="mt-1 mb-6 max-w-xs text-center text-xs leading-5 text-muted-foreground">
                    Screen, window, or area — or paste an image to edit.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      // Reset so picking the same file again still fires onChange.
                      e.target.value = '';
                      if (file) void openImage(file);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="md"
                      title="Browse for an image to edit — you can also paste one"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageUp size={16} />
                      Browse
                    </Button>
                    {!usesOsPicker && !isToolbarOpen && (
                      <Button variant="primary" size="md" onClick={handleCapture}>
                        <Camera size={16} />
                        Capture
                      </Button>
                    )}
                    {usesOsPicker && (
                      <div className="inline-flex">
                        <Button
                          variant="primary"
                          size="md"
                          className="rounded-r-none"
                          onClick={() => void runRegionCapture()}
                        >
                          <Camera size={16} />
                          Capture
                        </Button>
                        <Menu.Root>
                          <Menu.Trigger
                            aria-label="Capture after delay"
                            render={
                              <Button
                                variant="primary"
                                size="md"
                                className="rounded-l-none border-l border-emphasis-text/25 px-1.5"
                              />
                            }
                          >
                            <ChevronDown size={14} />
                          </Menu.Trigger>
                          <Menu.Content side="top" align="end">
                            {CAPTURE_DELAY_OPTIONS.map((seconds) => (
                              <Menu.Item
                                key={seconds}
                                onClick={() => void runRegionCapture(seconds)}
                              >
                                Wait {seconds} seconds
                              </Menu.Item>
                            ))}
                          </Menu.Content>
                        </Menu.Root>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Paste with{' '}
                    <kbd className="rounded bg-surface-3 px-1.5 py-0.5 font-medium">
                      {window.api?.platform === 'darwin' ? '⌘V' : 'Ctrl+V'}
                    </kbd>
                  </p>
                  {usesOsPicker && (
                    <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={hideApp}
                        onChange={(e) => toggleHideApp(e.target.checked)}
                        className="accent-(--color-accent)"
                      />
                      Hide this app while capturing
                    </label>
                  )}
                </>
              )}
            </div>
          )}
          {isCapturing && (
            <div className="flex min-h-[12rem] flex-1 items-center justify-center">
              <p className="text-sm text-text-dim">{capturingMessage}</p>
            </div>
          )}

          {phase === 'result' && previewDataUrl && (
            <div className="bg-dotted flex min-h-0 flex-1 items-stretch gap-3 overflow-hidden px-6 py-6">
              <EditorToolbar />
              <CaptureEditor dataUrl={previewDataUrl} />
              <LayerPanel />
            </div>
          )}
        </div>
      </div>

      {phase === 'result' && (
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-dark bg-surface px-6 py-4">
          <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void handleCopy()}>
            {busy === 'copy' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : confirmed === 'copy' ? (
              <CircleCheck size={14} />
            ) : (
              <ClipboardCopy size={14} />
            )}
            Copy to clipboard
          </Button>
          <div className="inline-flex">
            <Button
              variant="secondary"
              size="sm"
              disabled={!!busy}
              className="rounded-r-none"
              onClick={() => void handleSave('png')}
            >
              {busy === 'save' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : confirmed === 'save' ? (
                <CircleCheck size={14} />
              ) : (
                <Download size={14} />
              )}
              Save to file
            </Button>
            <Menu.Root>
              <Menu.Trigger
                disabled={!!busy}
                aria-label="Save as…"
                render={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!!busy}
                    className="rounded-l-none border-l-0 px-1.5"
                  />
                }
              >
                <ChevronDown size={14} />
              </Menu.Trigger>
              <Menu.Content side="top" align="end">
                {CAPTURE_EXPORT_FORMATS.map((format) => (
                  <Menu.Item
                    key={format.id}
                    disabled={!!busy}
                    onClick={() => void handleSave(format.id)}
                  >
                    {format.label}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Root>
          </div>
          <Button variant="primary" size="sm" disabled={!!busy} onClick={handleCaptureAgain}>
            <Camera size={14} />
            Capture again
          </Button>
        </footer>
      )}
    </div>
  );
}

export default ScreenCaptureMain;
