import { Circle, Square } from 'lucide-react';
import { useAppStore } from '../../../app/app-store';
import { Button } from '@renderer/components/ui/Button';
import { openRecorderToolbarFor } from '../lib/open-recorder-toolbar';

export function LaunchRecorderButton() {
  const isRecording = useAppStore((state) => state.isRecording);
  const route = useAppStore((state) => state.route);
  const isEditor = route === 'editor' || isRecording;

  async function handleNewRecord() {
    if (isEditor) {
      const confirmed = window.confirm(
        'Leave the editor and start a new recording? Any unsaved changes will be lost.'
      );
      if (!confirmed) return;
    }

    const sources = await window.screenRecorder.recording.getCaptureSources();
    const defaultSource =
      sources.find((s) => s.type === 'screen' && s.isPrimaryDisplay) ??
      sources.find((s) => s.type === 'screen') ??
      sources[0];
    if (defaultSource) await openRecorderToolbarFor(defaultSource);
  }

  return (
    <Button onClick={handleNewRecord} variant="outline">
      {isRecording ? (
        <Square size={12} className="text-muted-foreground" fill="currentColor" />
      ) : (
        <Circle size={12} className="text-danger" fill="currentColor" />
      )}
      <span>Return to Recorder</span>
    </Button>
  );
}
