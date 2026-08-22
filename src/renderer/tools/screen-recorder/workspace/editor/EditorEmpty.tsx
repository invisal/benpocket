import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useToastStore } from '../../store/toast-store';
import { importVideoFile } from '../../features/project/lib/import-video';
import { Button } from '@renderer/components/ui/Button';

/**
 * EditorPage's empty state -- shown once the Editor route no longer requires
 * a `lastRecording` to be reachable (see ScreenRecorderSidebar.tsx). Reuses
 * the sidebar's own `importVideoFile` for "Browse video…" so either entry
 * point lands in the exact same place (a fresh, unsaved 'imported' project).
 */
export default function EditorEmpty() {
  const [isImporting, setIsImporting] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  async function handleBrowseVideo(): Promise<void> {
    setIsImporting(true);
    try {
      await importVideoFile();
    } catch (err) {
      console.error('[editor] failed to import video:', err);
      showToast('Failed to import video', 'error');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface p-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Upload size={18} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">Nothing to edit yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Record something, or browse for an existing video to bring it into the editor.
        </p>
      </div>
      <Button
        variant="secondary"
        onClick={() => void handleBrowseVideo()}
        disabled={isImporting}
        className="mt-1"
      >
        {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Browse video…
      </Button>
    </div>
  );
}
