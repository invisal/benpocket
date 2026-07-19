import type { JSX } from 'react';
import { useRef, useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { Camera, CircleCheck, ClipboardCopy, Download, Scan } from 'lucide-react';
import { cn } from 'cnfast';
import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { Button } from '@renderer/components/ui/Button';
import type { CaptureSource } from '@screen-recorder/types/recording';
import { ScreenRecordingPermissionBanner } from '@screen-recorder/features/recording/components/ScreenRecordingPermissionBanner';
import { SourcePickerPanels } from './components/SourcePicker';
import { useCaptureSources, type SourceTab } from './lib/use-capture-sources';
import {
  blobToDataUrl,
  captureFromSource,
  selectAndCaptureRegion,
  screenshotFileName,
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
  const confirmTimer = useRef<number | undefined>(undefined);

  const flashConfirm = (action: 'copy' | 'save'): void => {
    setConfirmed(action);
    window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirmed(null), 1500);
  };

  const { screens, windows, sources, activeTab, setActiveTab, loading } = useCaptureSources(
    setSelectedSource,
    { enabled: !usesOsPicker }
  );

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
    setPreviewBlob(blob);
    setPreviewDataUrl(dataUrl);
    setPhase('result');

    void copyAfterCapture(blob).then((copied) => {
      if (!copied) console.error('Could not copy screenshot to clipboard.');
    });
  };

  const runRegionCapture = async (): Promise<void> => {
    setCaptureMode('region');
    setCaptureStep('picker');
    setPhase('capturing');
    setPreviewDataUrl(null);
    setPreviewBlob(null);

    try {
      const blob = await selectAndCaptureRegion(sources, usesOsPicker, (step) => {
        setCaptureStep(step);
        setPhase('capturing');
      });
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
      const blob = await captureFromSource(source);
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
    setPhase('idle');
    setPreviewDataUrl(null);
    setPreviewBlob(null);
    setConfirmed(null);
  };

  const handleCopy = async (): Promise<void> => {
    if (!previewBlob) return;
    if (await copyToClipboard(previewBlob)) {
      flashConfirm('copy');
    } else {
      console.error('Could not copy screenshot to clipboard.');
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!previewBlob || !window.screenRecorder) return;

    try {
      const arrayBuffer = await previewBlob.arrayBuffer();
      const filePath = await window.screenRecorder.screenshot.save(
        arrayBuffer,
        screenshotFileName()
      );
      if (filePath) flashConfirm('save');
    } catch (err) {
      console.error('Could not save screenshot.', err);
    }
  };

  const captureDisabled = usesOsPicker ? false : !selectedSource || loading;

  const idleDescription = usesOsPicker
    ? 'Click Capture to choose a screen, window, or region in the system dialog.'
    : undefined;

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
            usesOsPicker ? (
              <div>
                <h1 className="text-base font-medium">Screen Capture</h1>
                <p className="mt-0.5 text-xs text-text-dim">
                  Capture a full screen or window, or drag a region.
                </p>
              </div>
            ) : (
              <Tabs.List className="flex items-center gap-1">
                <Tabs.Tab value="screen" className={headerTabClass(activeTab === 'screen')}>
                  Entire Screen{screens.length > 0 ? ` (${screens.length})` : ''}
                </Tabs.Tab>
                <Tabs.Tab value="window" className={headerTabClass(activeTab === 'window')}>
                  Window{windows.length > 0 ? ` (${windows.length})` : ''}
                </Tabs.Tab>
              </Tabs.List>
            )
          ) : (
            <div>
              <h1 className="text-base font-medium">Preview</h1>
              <p className="mt-0.5 text-xs text-text-dim">Save your screenshot or capture again.</p>
            </div>
          )}
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-2',
            phase === 'result' ? 'px-6 py-6' : 'p-6 pb-4',
            phase === 'idle' && 'overflow-y-auto'
          )}
        >
          <ScreenRecordingPermissionBanner />

          {phase === 'idle' && usesOsPicker && idleDescription && (
            <p className="text-sm text-text-dim">{idleDescription}</p>
          )}

          {phase === 'idle' && !usesOsPicker && (
            <div className="w-full min-w-0">
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
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              <img
                src={previewDataUrl}
                alt="Captured screenshot"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </div>
      </div>

      {phase === 'result' && (
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-dark bg-surface px-6 py-4">
          <Button variant="secondary" size="sm" onClick={() => void handleCopy()}>
            {confirmed === 'copy' ? <CircleCheck size={14} /> : <ClipboardCopy size={14} />}
            Copy to clipboard
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleSave()}>
            {confirmed === 'save' ? <CircleCheck size={14} /> : <Download size={14} />}
            Save to file
          </Button>
          <Button variant="primary" size="sm" onClick={handleCaptureAgain}>
            <Camera size={14} />
            Capture again
          </Button>
        </footer>
      )}

      {phase === 'idle' && (
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border-dark bg-surface px-6 py-4">
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
