import { Circle, Square } from 'lucide-react';
import { useAppStore } from '../app/app-store';
import { AudioSourceToggle } from '../features/recording/components/AudioSourceToggle';
import { AutoZoomToggle } from '../features/recording/components/AutoZoomToggle';
import { WebcamShapePicker } from '../features/webcam/components/WebcamShapePicker';
import { Button } from '@renderer/components/ui/Button';
import { openRecorderToolbarFor } from '@screen-recorder/features/recording/lib/open-recorder-toolbar';

export const ScreenRecorderSidebar: React.FC = () => {
  const isRecording = useAppStore((state) => state.isRecording);
  const isRecorderToolbarOpen = useAppStore((state) => state.isRecorderToolbarOpen);
  const route = useAppStore((state) => state.route);
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
  // isRecorderToolbarOpen alone already covers isRecording (a recording
  // can't be running without the toolbar that started it also being open),
  // but isRecording is kept in the condition since it's the more direct,
  // obviously-correct reason to disable this if the two ever desync.
  const disabled = route === 'editor' || isRecording || isRecorderToolbarOpen;
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

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-zinc-500 uppercase">Zoom</span>
        <AutoZoomToggle />
      </div>
    </div>
  );
};
