import type { JSX } from 'react';
import { useState } from 'react';
import { Camera, ClipboardCopy, Download } from 'lucide-react';
import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { Button } from '@renderer/components/ui/Button';
import { notifyError, notifySuccess } from '@renderer/lib/notify';
import { ScreenRecordingPermissionBanner } from '@screen-recorder/features/recording/components/ScreenRecordingPermissionBanner';
import { blobToDataUrl, captureFromSystemPicker, screenshotFileName } from './lib/capture-frame';

interface Props {}

type Phase = 'idle' | 'capturing' | 'failed' | 'result';

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
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCapture = async (): Promise<void> => {
    setPhase('capturing');
    setError(null);
    setPreviewDataUrl(null);
    setPreviewBlob(null);

    try {
      const blob = await captureFromSystemPicker();
      const dataUrl = await blobToDataUrl(blob);
      setPreviewBlob(blob);
      setPreviewDataUrl(dataUrl);
      setPhase('result');

      // Let restore/focus settle before writing clipboard (GNOME/Wayland).
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPhase('failed');
      notifyError(message);
    }
  };

  const handleCaptureAgain = (): void => {
    setPhase('idle');
    setPreviewDataUrl(null);
    setPreviewBlob(null);
    setError(null);
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
    <div className="flex h-full min-h-0 flex-col bg-surface text-text-base">
      <div className="shrink-0 border-b border-border-dark px-6 py-4">
        <h1 className="text-base font-medium">Screen Capture</h1>
        <p className="mt-0.5 text-xs text-text-dim">
          {phase === 'idle' && 'Take a screenshot of your screen or a window.'}
          {phase === 'capturing' && 'Choose what to share in the system dialog…'}
          {phase === 'failed' && 'Capture failed.'}
          {phase === 'result' && 'Save your screenshot or capture again.'}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-6">
        {phase === 'idle' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <ScreenRecordingPermissionBanner />
            <Button variant="primary" onClick={() => void runCapture()}>
              <Camera size={14} />
              Capture
            </Button>
          </div>
        )}

        {phase === 'capturing' && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-dim">Capturing…</p>
          </div>
        )}

        {phase === 'failed' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="max-w-md text-center text-sm text-danger">{error}</p>
            <Button variant="primary" onClick={handleCaptureAgain}>
              <Camera size={14} />
              Capture again
            </Button>
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
    </div>
  );
}

export default ScreenCaptureMain;
