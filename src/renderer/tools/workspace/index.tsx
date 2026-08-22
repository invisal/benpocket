import { useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { ToolLayout } from '@renderer/components/layout/ToolLayout';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import { Toolbar } from '@renderer/components/ui/Toolbar';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import {
  FilePreview,
  type PreviewEditorHandle
} from '../file-explorer/components/previews/FilePreview';
import { WorkspaceTree } from './components/WorkspaceTree';
import {
  createWorkspaceStore,
  WorkspaceStoreContext,
  useWorkspaceStore
} from './store/workspace.store';

interface Props {
  path: string;
}

export function WorkspaceMain({ payload }: ToolComponentProps<Props>) {
  const [store] = useState(() => createWorkspaceStore(payload.path));

  return (
    <WorkspaceStoreContext.Provider value={store}>
      <ToolLayout.Title>{basename(payload.path)}</ToolLayout.Title>
      <WorkspaceLayout />
    </WorkspaceStoreContext.Provider>
  );
}

function basename(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() || path
  );
}

function WorkspaceLayout() {
  const previewFile = useWorkspaceStore((s) => s.previewFile);
  const isDirty = useWorkspaceStore((s) => s.isDirty);
  const setPreviewFile = useWorkspaceStore((s) => s.setPreviewFile);
  const setDirty = useWorkspaceStore((s) => s.setDirty);
  const refresh = useWorkspaceStore((s) => s.refresh);

  const [sidebarWidth, setSidebarWidth] = useState(240);
  const editorRef = useRef<PreviewEditorHandle>(null);

  // Path the user clicked while the current preview buffer was dirty --
  // non-null while the unsaved-changes dialog is open.
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  function handleSelectFile(path: string) {
    if (path === previewFile) return;
    if (isDirty) {
      setPendingFile(path);
      return;
    }
    setPreviewFile(path);
  }

  function handleDiscard() {
    setDirty(false);
    setPreviewFile(pendingFile);
    setPendingFile(null);
    setDialogError(null);
  }

  async function handleSaveAndSwitch() {
    setIsSaving(true);
    setDialogError(null);
    const success = await editorRef.current?.save();
    setIsSaving(false);
    if (!success) {
      setDialogError("Couldn't save changes. Try again or discard them.");
      return;
    }
    setDirty(false);
    setPreviewFile(pendingFile);
    setPendingFile(null);
  }

  function handleCancelSwitch() {
    setPendingFile(null);
    setDialogError(null);
  }

  return (
    <div className="flex-1 flex min-h-0 min-w-0 bg-surface">
      <ResizablePanel
        edge="right"
        size={sidebarWidth}
        onResize={setSidebarWidth}
        min={150}
        max={480}
        className="bg-surface border-r border-border flex flex-col h-full overflow-y-auto"
      >
        <WorkspaceTree previewFile={previewFile} onSelectFile={handleSelectFile} />
      </ResizablePanel>
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <Toolbar.Root>
          <div className="flex-1 px-3 text-sm text-text-dim truncate">
            {previewFile ? basename(previewFile) : ''}
          </div>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Toolbar.Button shape="square" onClick={refresh}>
                  <RotateCw size={14} />
                </Toolbar.Button>
              }
            />
            <Tooltip.Content>Refresh</Tooltip.Content>
          </Tooltip.Root>
        </Toolbar.Root>
        <FilePreview
          ref={editorRef}
          previewFile={previewFile}
          unavailableReason="no-selection"
          onDirtyChange={setDirty}
        />
      </div>
      <Dialog.Root
        open={pendingFile !== null}
        onOpenChange={(open) => !open && handleCancelSwitch()}
      >
        <Dialog.Content className="max-w-sm" showClose={false}>
          <Dialog.Title>Unsaved changes</Dialog.Title>
          <Dialog.Description>
            {previewFile ? basename(previewFile) : 'This file'} has unsaved changes. Save them
            before switching files?
          </Dialog.Description>
          {dialogError && <p className="mt-2 text-sm text-red-500">{dialogError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleCancelSwitch}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSaveAndSwitch()}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}

export default WorkspaceMain;
