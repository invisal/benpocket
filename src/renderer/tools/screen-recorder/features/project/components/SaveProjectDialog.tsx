import type { JSX } from 'react';
import { useState } from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Input } from '@renderer/components/ui/Input';
import { Button } from '@renderer/components/ui/Button';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { useToastStore } from '../../../store/toast-store';
import { buildProjectSnapshot } from '../lib/build-project-snapshot';
import { resetHistory } from '../../history/store/history-store';

interface SaveProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SaveProjectFormProps {
  initialName: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Only mounted while the dialog is open (see SaveProjectDialog below) --
 * that's what resets `name`/`error`/`isSaving` between opens, rather than an
 * effect or ref-based reset watching for the closed -> open transition.
 */
function SaveProjectForm({ initialName, onOpenChange }: SaveProjectFormProps): JSX.Element {
  const setProjectName = useScreenRecorderStore((s) => s.setProjectName);
  const setCurrentProjectId = useScreenRecorderStore((s) => s.setCurrentProjectId);
  const bumpProjectsVersion = useScreenRecorderStore((s) => s.bumpProjectsVersion);
  const showToast = useToastStore((s) => s.showToast);

  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a project name.');
      return;
    }
    const project = buildProjectSnapshot(trimmed);
    if (!project) {
      setError('Nothing to save yet -- record something first.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const ok = await window.screenRecorder.project.save(project);
      if (!ok) {
        setError('Failed to save the project. Try again.');
        return;
      }
      setProjectName(trimmed);
      setCurrentProjectId(project.id);
      bumpProjectsVersion();
      resetHistory();
      showToast('Project saved');
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Dialog.Title className="text-xl">Save project</Dialog.Title>
        <Dialog.Description>Give this project a name to save your edits.</Dialog.Description>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">Project name</span>
        <Input
          size="lg"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave();
          }}
          placeholder="Untitled Recording"
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

export function SaveProjectDialog({ open, onOpenChange }: SaveProjectDialogProps): JSX.Element {
  const projectName = useScreenRecorderStore((s) => s.projectName);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-sm">
        {open && <SaveProjectForm initialName={projectName} onOpenChange={onOpenChange} />}
      </Dialog.Content>
    </Dialog.Root>
  );
}
