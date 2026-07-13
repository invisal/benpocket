import { Circle, Square } from 'lucide-react';
import { useAppStore } from '../app/app-store';
import { useRecordingStore } from '../features/recording/store/recording-store';
import { AudioSourceToggle } from '../features/recording/components/AudioSourceToggle';
import { WebcamShapePicker } from '../features/webcam/components/WebcamShapePicker';
import {
  startCapture,
  fileExtensionForBlob,
  type CaptureHandle
} from '../features/recording/engine/capture-engine';
import {
  startCursorCapture,
  type CursorCaptureHandle
} from '../features/cursor/engine/cursor-capture';
import { generateAutoZoomKeyframes } from '../features/zoom/engine/auto-zoom-engine';
import { useZoomStore } from '../features/zoom/store/zoom-store';
import { Button } from '@renderer/components/ui/Button';
import { useRef, useState } from 'react';

export const ScreenRecorderSidebar: React.FC = () => {
  const selectedSource = useRecordingStore((state) => state.selectedSource);
  const audio = useRecordingStore((state) => state.audio);
  const isRecording = useAppStore((state) => state.isRecording);
  const setIsRecording = useAppStore((state) => state.setIsRecording);
  const setRoute = useAppStore((state) => state.setRoute);
  const setLastRecording = useAppStore((state) => state.setLastRecording);
  const route = useAppStore((state) => state.route);
  const [error, setError] = useState<string | null>(null);
  const [liveCounts, setLiveCounts] = useState<{ cursorCount: number; clickCount: number } | null>(
    null
  );
  const captureRef = useRef<CaptureHandle | null>(null);
  const cursorCaptureRef = useRef<CursorCaptureHandle | null>(null);

  async function handleStart(): Promise<void> {
    if (!selectedSource) {
      setError('Pick a screen or window first.');
      return;
    }
    setError(null);
    setLiveCounts({ cursorCount: 0, clickCount: 0 });
    try {
      // `selectedSource.displayBounds` for a window source (currently just
      // the Simulator) was resolved via AppleScript whenever the source list
      // was last loaded -- possibly well before this click, during which the
      // window could have moved or resized. Re-resolve it right now, as
      // close to the actual capture/tracking start as possible, so both the
      // video's capture-size constraint and the cursor normalization rect
      // agree with where the window actually is.
      const source =
        selectedSource.type === 'window'
          ? {
              ...selectedSource,
              displayBounds:
                (await window.screenRecorder.simulator.refreshWindowBounds().catch(() => null)) ??
                selectedSource.displayBounds
            }
          : selectedSource;

      captureRef.current = await startCapture({ source, audio });
      // Uses the recorder's *actual* startedAt (not a pre-call guess) so
      // cursor samples line up exactly with the video's own t=0.
      cursorCaptureRef.current = await startCursorCapture(
        source,
        captureRef.current.startedAt,
        setLiveCounts
      );
      if (!cursorCaptureRef.current) setLiveCounts(null);
      setIsRecording(true);
    } catch (err) {
      // Most likely cause: the user denied the (rare, OS-level) permission
      // prompt, or no capture source is actually available.
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleStop(): Promise<void> {
    const capture = captureRef.current;
    if (!capture) return;
    setIsRecording(false);

    const blob = await capture.stop();
    captureRef.current = null;

    const { cursorPath, clickPath } = (await cursorCaptureRef.current?.stop()) ?? {
      cursorPath: [],
      clickPath: []
    };
    cursorCaptureRef.current = null;

    // Fresh recording -> whatever zoom keyframes existed belonged to the
    // previous one and no longer mean anything on this timeline. Re-seed
    // from this recording's real clicks when in auto mode, otherwise just
    // clear them for the user to place manually.
    const zoomStore = useZoomStore.getState();
    zoomStore.setKeyframes(zoomStore.mode === 'auto' ? generateAutoZoomKeyframes(clickPath) : []);

    const previewUrl = URL.createObjectURL(blob);
    const extension = fileExtensionForBlob(blob);
    const fileName = `recording-${Date.now()}.${extension}`;

    let filePath: string | null = null;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      filePath = await window.screenRecorder.recording.saveFile(fileName, arrayBuffer);
    } catch (err) {
      console.error('[ScreenRecorderSidebar] failed to save recording to disk:', err);
    }

    setLastRecording({
      previewUrl,
      filePath,
      sizeBytes: blob.size,
      createdAt: Date.now(),
      cursorPath,
      clickPath
    });
    setRoute('editor');
  }
  const disabled = !selectedSource || route !== 'record-setup';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          ScreenRecorder
        </span>
      </div>

      <Button
        onClick={isRecording ? handleStop : handleStart}
        variant="secondary"
        className="w-full"
        disabled={disabled}
      >
        {isRecording ? (
          <Square size={12} className="text-zinc-500" fill="currentColor" />
        ) : (
          <Circle size={12} className="text-red-500" fill="currentColor" />
        )}
        <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
      </Button>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-zinc-500 uppercase">Audio</span>
        <AudioSourceToggle />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-zinc-500 uppercase">Webcam</span>
        <WebcamShapePicker />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {liveCounts && (isRecording || liveCounts.cursorCount > 0 || liveCounts.clickCount > 0) && (
        <p
          className={`text-[10px] ${
            liveCounts.cursorCount > 0 ? 'text-emerald-400/70' : 'text-amber-400/70'
          }`}
        >
          {isRecording ? 'Tracking: ' : 'Tracked '}
          {liveCounts.cursorCount} cursor point{liveCounts.cursorCount === 1 ? '' : 's'},{' '}
          {liveCounts.clickCount} click{liveCounts.clickCount === 1 ? '' : 's'}
          {isRecording && liveCounts.cursorCount === 0 ? ' -- move your mouse to test' : ''}
        </p>
      )}
    </div>
  );
};
