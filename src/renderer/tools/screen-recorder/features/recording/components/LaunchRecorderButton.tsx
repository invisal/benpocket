import { Circle, Square } from 'lucide-react';
import { useAppStore } from '../../../app/app-store';
import { Button } from '@renderer/components/ui/Button';
import { openRecorderToolbarFor } from '../lib/open-recorder-toolbar';

export function LaunchRecorderButton() {
  const isRecording = useAppStore((state) => state.isRecording);
  const route = useAppStore((state) => state.route);

  async function handleNewRecord() {
    const sources = await window.screenRecorder.recording.getCaptureSources();
    const defaultSource =
      sources.find((s) => s.type === 'screen' && s.isPrimaryDisplay) ??
      sources.find((s) => s.type === 'screen') ??
      sources[0];
    if (defaultSource) await openRecorderToolbarFor(defaultSource);
  }

  const disabled = route === 'editor' || isRecording;

  return (
    <Button onClick={handleNewRecord} variant="outline" disabled={disabled}>
      {isRecording ? (
        <Square size={12} className="text-muted-foreground" fill="currentColor" />
      ) : (
        <Circle size={12} className="text-danger" fill="currentColor" />
      )}
      <span>New Screen Recording</span>
    </Button>
  );
}
