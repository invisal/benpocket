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

    // No source passed -- opens the toolbar immediately instead of waiting
    // on a full capture-sources fetch (thumbnails for every screen/window
    // is the slow part); the toolbar picks its own default once its own
    // fetch resolves. See openRecorderToolbarFor's doc.
    await openRecorderToolbarFor();
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
