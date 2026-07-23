import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import {
  Camera,
  ChevronDown,
  CircleCheck,
  ClipboardCopy,
  Download,
  ImageUp,
  Loader2,
  Scan
} from 'lucide-react';
import { cn } from 'cnfast';
import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { Button } from '@renderer/components/ui/Button';
import { Menu } from '@renderer/components/ui/Menu';
import type { CaptureSource } from '@screen-recorder/types/recording';
import { ScreenRecordingPermissionBanner } from '@screen-recorder/features/recording/components/ScreenRecordingPermissionBanner';
import { SourcePickerPanels } from './components/SourcePicker';
import { CaptureEditor } from './components/CaptureEditor';
import { EditorToolbar } from './components/EditorToolbar';
import { LayerPanel } from './components/LayerPanel';
import { useCaptureEditorStore } from './store/editor.store';
import { flattenImage } from './lib/flatten';
import { useCaptureSources, type SourceTab } from './lib/use-capture-sources';
import {
  blobToDataUrl,
  CAPTURE_EXPORT_FORMATS,
  captureFromSource,
  encodeCaptureBlob,
  selectAndCaptureRegion,
  screenshotFileName,
  toPngBlob,
  type CaptureExportFormat,
  type RegionCaptureStep
} from './lib/capture-frame';

interface Props {}

type Phase = 'idle' | 'capturing' | 'result';
type CaptureMode = 'source' | 'region';

function headerTabClass(active: boolean): string {
  return cn(
    'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
    active ? 'bg-accent/10 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text-base'
  );
}

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
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [confirmed, setConfirmed] = useState<'copy' | 'save' | null>(null);
  const [busy, setBusy] = useState<'copy' | 'save' | null>(null);
  const [hideApp, setHideApp] = useState(
    () => localStorage.getItem('screen-capture.hide-app') !== 'false'
  );
  const confirmTimer = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setHideApp(next);
    localStorage.setItem('screen-capture.hide-app', String(next));
  };

  const flashConfirm = (action: 'copy' | 'save'): void => {
    setConfirmed(action);
    window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirmed(null), 1500);
  };

  const { screens, windows, sources, activeTab, setActiveTab, loading } = useCaptureSources(
    setSelectedSource,
    { enabled: !usesOsPicker }
  );

  // Pasting an image on the main screen opens it in the editor.
  useEffect(() => {
    if (phase !== 'idle') return;
    function onPaste(event: ClipboardEvent): void {
      const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/')
      );
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void openImage(file);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [phase, openImage]);

  // Keeps the clipboard in sync with the editor: every annotation or
  // corner-radius change re-flattens and copies, debounced so a drag doesn't
  // re-encode a full-resolution PNG on every pointermove frame.
  useEffect(() => {
    if (phase !== 'result' || !previewBlob) return;

    let timer: number | undefined;
    // Guards against an older, slower flatten finishing after a newer one
    // and overwriting the clipboard with stale content.
    let generation = 0;

    const unsubscribe = useCaptureEditorStore.subscribe((state, previous) => {
      if (
        state.annotations === previous.annotations &&
        state.cornerRadius === previous.cornerRadius &&
        state.crop === previous.crop &&
        state.background === previous.background &&
        state.watermark === previous.watermark
      ) {
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        generation += 1;
        const current = generation;
        void flattenFromEditorState(previewBlob)
          .then((blob) => (current === generation ? copyAfterCapture(blob) : true))
          .then((copied) => {
            if (!copied) console.error('Could not copy edited screenshot to clipboard.');
          });
      }, 600);
    });

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [phase, previewBlob]);

  const handleTabChange = (value: string): void => {
    const tab = value as SourceTab;
    setActiveTab(tab);
    const tabSources = tab === 'screen' ? screens : windows;
    if (tabSources.length === 0) {
      setSelectedSource(null);
      return;
    }
    if (!selectedSource || selectedSource.type !== tab) {
      setSelectedSource(tabSources[0]);
    }
  };

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

  const runRegionCapture = async (): Promise<void> => {
    setCaptureMode('region');
    setCaptureStep('picker');
    setPhase('capturing');
    setPreviewDataUrl(null);
    setPreviewBlob(null);

    try {
      const blob = await selectAndCaptureRegion(
        sources,
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

  // macOS / Windows / Linux X11 only — Linux Wayland always goes through
  // runRegionCapture's native picker instead (see the merged footer button).
  const runCapture = async (source = selectedSource): Promise<void> => {
    if (!source) return;

    setSelectedSource(source);
    setCaptureMode('source');
    setCaptureStep('picker');
    setPhase('capturing');
    setPreviewDataUrl(null);
    setPreviewBlob(null);

    try {
      // Checked = platform default (hide for screen grabs, keep visible for
      // window grabs); unchecked = never hide.
      const blob = await captureFromSource(source, hideApp ? undefined : { hideApp: false });
      await finishCapture(blob);
    } catch {
      setPhase('idle');
    }
  };

  const handleSourceDoubleClick = (source: CaptureSource): void => {
    if (loading || phase !== 'idle') return;
    void runCapture(source);
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

  const captureDisabled = usesOsPicker ? false : !selectedSource || loading;

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

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full min-h-0 flex-col bg-surface text-text-base"
    >
      {phase !== 'capturing' && (
        <header className="shrink-0 border-b border-border-dark px-6 py-4">
          {phase === 'idle' ? (
            <div>
              <h1 className="text-base font-medium">Screen Capture</h1>
              <p className="mt-0.5 text-xs text-text-dim">
                Capture a full screen or window, or drag a region. You can also paste (Ctrl+V) or
                open an image to edit it.
              </p>
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

          {phase === 'idle' && !usesOsPicker && (
            <div className="flex w-full min-w-0 flex-col gap-3">
              <Tabs.List className="flex items-center gap-1">
                <Tabs.Tab value="screen" className={headerTabClass(activeTab === 'screen')}>
                  Entire Screen{screens.length > 0 ? ` (${screens.length})` : ''}
                </Tabs.Tab>
                <Tabs.Tab value="window" className={headerTabClass(activeTab === 'window')}>
                  Window{windows.length > 0 ? ` (${windows.length})` : ''}
                </Tabs.Tab>
              </Tabs.List>
              {loading ? (
                <p className="text-sm text-text-dim">Loading sources…</p>
              ) : (
                <SourcePickerPanels
                  activeTab={activeTab}
                  screens={screens}
                  windows={windows}
                  selectedSource={selectedSource}
                  onSelectSource={setSelectedSource}
                  onCaptureSource={handleSourceDoubleClick}
                />
              )}
            </div>
          )}

          {phase === 'capturing' && (
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

      {phase === 'idle' && (
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border-dark bg-surface px-6 py-4">
          <label className="mr-auto flex cursor-pointer items-center gap-2 text-xs text-text-dim select-none">
            <input
              type="checkbox"
              checked={hideApp}
              onChange={(e) => toggleHideApp(e.target.checked)}
              className="accent-(--color-accent)"
            />
            Hide this app while capturing
          </label>
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
          <Button
            variant="secondary"
            size="sm"
            title="Open an image to edit — you can also paste one (Ctrl+V)"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageUp size={14} />
            Open image
          </Button>
          {/* Linux Wayland: GNOME's native picker already offers screen / window /
              selection in one UI, so a separate "Capture region" button is redundant. */}
          {!usesOsPicker && (
            <Button variant="secondary" size="sm" onClick={() => void runRegionCapture()}>
              <Scan size={14} />
              Capture region
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            disabled={captureDisabled}
            onClick={() => void (usesOsPicker ? runRegionCapture() : runCapture())}
          >
            <Camera size={14} />
            Capture
          </Button>
        </footer>
      )}
    </Tabs.Root>
  );
}

export default ScreenCaptureMain;
