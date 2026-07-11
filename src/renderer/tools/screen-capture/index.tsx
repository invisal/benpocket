import type { JSX } from 'react';
import { useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { Camera, ClipboardCopy, Download } from 'lucide-react';
import { cn } from 'cnfast';
import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { Button } from '@renderer/components/ui/Button';
import { notifyError, notifySuccess } from '@renderer/lib/notify';
import type { CaptureSource } from '@screen-recorder/types/recording';
import { ScreenRecordingPermissionBanner } from '@screen-recorder/features/recording/components/ScreenRecordingPermissionBanner';
import { SourcePickerPanels } from './components/SourcePicker';
import { useCaptureSources, type SourceTab } from './lib/use-capture-sources';
import { blobToDataUrl, captureFromSource, screenshotFileName } from './lib/capture-frame';

interface Props {}

type Phase = 'idle' | 'capturing' | 'result';

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
  const [phase, setPhase] = useState<Phase>('idle');
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const { screens, windows, activeTab, setActiveTab, loading, error } =
    useCaptureSources(setSelectedSource);

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

  const runCapture = async (): Promise<void> => {
    if (!selectedSource) return;

    setPhase('capturing');
    setPreviewDataUrl(null);
    setPreviewBlob(null);

    try {
      const blob = await captureFromSource(selectedSource);
      const dataUrl = await blobToDataUrl(blob);
      setPreviewBlob(blob);
      setPreviewDataUrl(dataUrl);
      setPhase('result');

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const copied = await copyAfterCapture(blob);
      if (copied) {
        notifySuccess('Screenshot captured and copied to clipboard.');
      } else {
        notifySuccess('Screenshot captured.');
        notifyError('Could not copy to clipboard.');
      }
    } catch {
      setPhase('idle');
    }
  };

  const handleCaptureAgain = (): void => {
    setPhase('idle');
    setPreviewDataUrl(null);
    setPreviewBlob(null);
  };

  const handleCopy = async (): Promise<void> => {
    if (!previewBlob) return;
    if (await copyToClipboard(previewBlob)) {
      notifySuccess('Copied to clipboard.');
    } else {
      notifyError('Could not copy to clipboard.');
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
      if (filePath) {
        notifySuccess(`Saved to ${filePath}.`);
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not save screenshot.');
    }
  };

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full min-h-0 flex-col bg-surface text-text-base"
    >
      {phase !== 'capturing' && (
        <header className="shrink-0 border-b border-border-dark px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            {phase === 'idle' ? (
              <Tabs.List className="flex items-center gap-1">
                <Tabs.Tab value="screen" className={headerTabClass(activeTab === 'screen')}>
                  Entire Screen{screens.length > 0 ? ` (${screens.length})` : ''}
                </Tabs.Tab>
                <Tabs.Tab value="window" className={headerTabClass(activeTab === 'window')}>
                  Window{windows.length > 0 ? ` (${windows.length})` : ''}
                </Tabs.Tab>
              </Tabs.List>
            ) : (
              <div>
                <h1 className="text-base font-medium">Preview</h1>
                <p className="mt-0.5 text-xs text-text-dim">
                  Save your screenshot or capture again.
                </p>
              </div>
            )}

            {phase === 'idle' && (
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedSource || loading || Boolean(error)}
                onClick={() => void runCapture()}
              >
                <Camera size={14} />
                Capture
              </Button>
            )}
          </div>
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <ScreenRecordingPermissionBanner />

        {error && <p className="text-sm text-red-400">{error}</p>}

        {phase === 'idle' && !error && (
          <div className="w-full min-w-0">
            {loading ? (
              <p className="py-12 text-sm text-text-dim">Loading sources…</p>
            ) : (
              <SourcePickerPanels
                activeTab={activeTab}
                screens={screens}
                windows={windows}
                selectedSource={selectedSource}
                onSelectSource={setSelectedSource}
              />
            )}
          </div>
        )}

        {phase === 'capturing' && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-dim">Capturing…</p>
          </div>
        )}

        {phase === 'result' && previewDataUrl && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <img
              src={previewDataUrl}
              alt="Captured screenshot"
              className="min-h-0 flex-1 object-contain"
            />

            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" onClick={() => void handleCopy()}>
                <ClipboardCopy size={14} />
                Copy to clipboard
              </Button>
              <Button variant="secondary" onClick={() => void handleSave()}>
                <Download size={14} />
                Save to file
              </Button>
              <Button variant="primary" onClick={handleCaptureAgain}>
                <Camera size={14} />
                Capture again
              </Button>
            </div>
          </div>
        )}
      </div>
    </Tabs.Root>
  );
}

export default ScreenCaptureMain;
