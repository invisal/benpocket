import { Circle, Square } from 'lucide-react';
import { useAppStore } from '../app/app-store';
import { AudioSourceToggle } from '../features/recording/components/AudioSourceToggle';
import { WebcamShapePicker } from '../features/webcam/components/WebcamShapePicker';
import { useRecordingControllerContext } from '../features/recording/context/recording-controller-context';
import { Button } from '@renderer/components/ui/Button';
import { openRecorderToolbarFor } from '@screen-recorder/features/recording/lib/open-recorder-toolbar';

export const ScreenRecorderSidebar: React.FC = () => {
  const isRecording = useAppStore((state) => state.isRecording);
  const route = useAppStore((state) => state.route);
  const { error } = useRecordingControllerContext();
  async function handleNewRecord(): Promise<void> {
    const sources = await window.screenRecorder.recording.getCaptureSources();
    // Prefer the primary display -- desktopCapturer doesn't enumerate
    // screens in any guaranteed order, so falling back to "the first screen
    // source" would otherwise flip to whichever monitor the OS happened to
    // list first (e.g. a newly-connected external one) rather than actually
    // meaning "the main screen".
    const defaultSource =
      sources.find((s) => s.type === 'screen' && s.isPrimaryDisplay) ??
      sources.find((s) => s.type === 'screen') ??
      sources[0];
    if (defaultSource) await openRecorderToolbarFor(defaultSource);
  }
  const disabled = route === 'editor' || isRecording;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          ScreenRecorder
        </span>
      </div>

      <Button onClick={handleNewRecord} variant="secondary" className="w-full" disabled={disabled}>
        {isRecording ? (
          <Square size={12} className="text-zinc-500" fill="currentColor" />
        ) : (
          <Circle size={12} className="text-red-500" fill="currentColor" />
        )}
        <span>Launch Recorder</span>
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

      {/* {liveCounts && (isRecording || liveCounts.cursorCount > 0 || liveCounts.clickCount > 0) && (
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
      )} */}
    </div>
  );
};
