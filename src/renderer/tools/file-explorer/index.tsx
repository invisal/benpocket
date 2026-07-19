import { useCallback, useEffect, useRef, useState } from 'react';
import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { FileExplorerPanelBody } from './components/FileExplorerPanelBody';
import {
  FilePreview,
  type PreviewEditorHandle,
  type PreviewUnavailableReason
} from './components/previews/FilePreview';
import { FileExplorerSidebar } from './components/FileExplorerSidebar';
import { Breadcrumb } from './components/Breadcrumb';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import { type FileEntry } from './components/columns';
import {
  createFileExplorerStore,
  FileExplorerStoreContext,
  type PanelIndex,
  type PanelMode,
  useFileExplorerStore
} from './store/fileExplorer.store';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { AgentPanel } from './features/agent/components/AgentPanel';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function FileExplorerMain({}: ToolComponentProps<Props>) {
  const [store] = useState(() => createFileExplorerStore());

  return (
    <FileExplorerStoreContext.Provider value={store}>
      <FileExplorerLayout />
    </FileExplorerStoreContext.Provider>
  );
}

type PendingLeaveAction = { type: 'switch-mode' } | { type: 'switch-file'; path: string | null };
type PendingLeave = { panelIndex: PanelIndex; action: PendingLeaveAction };

function otherPanel(index: PanelIndex): PanelIndex {
  return index === 0 ? 1 : 0;
}

function computePreviewTarget(selection: FileEntry[]): {
  previewFile: string | null;
  unavailableReason: PreviewUnavailableReason;
} {
  if (selection.length === 0) return { previewFile: null, unavailableReason: 'no-selection' };
  if (selection.length > 1) return { previewFile: null, unavailableReason: 'multiple-selection' };
  const [entry] = selection;
  if (entry.isDirectory) return { previewFile: null, unavailableReason: 'directory' };
  return { previewFile: entry.path, unavailableReason: 'no-selection' };
}

function FileExplorerLayout() {
  const panels = useFileExplorerStore((s) => s.panels);
  const sidebarWidth = useFileExplorerStore((s) => s.sidebarWidth);
  const panel1Width = useFileExplorerStore((s) => s.panel1Width);
  const setPanelPath = useFileExplorerStore((s) => s.setPanelPath);
  const setPanelSelection = useFileExplorerStore((s) => s.setPanelSelection);
  const setPanelMode = useFileExplorerStore((s) => s.setPanelMode);
  const setPanelPreviewFile = useFileExplorerStore((s) => s.setPanelPreviewFile);
  const setPanelDirty = useFileExplorerStore((s) => s.setPanelDirty);
  const setActivePanel = useFileExplorerStore((s) => s.setActivePanel);
  const setSidebarWidth = useFileExplorerStore((s) => s.setSidebarWidth);
  const setPanel1Width = useFileExplorerStore((s) => s.setPanel1Width);

  const editorRef0 = useRef<PreviewEditorHandle>(null);
  const editorRef1 = useRef<PreviewEditorHandle>(null);
  const editorRefs = [editorRef0, editorRef1] as const;

  const [pendingLeave, setPendingLeave] = useState<PendingLeave | null>(null);
  const [isSavingPending, setIsSavingPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // `panels` changes reference on every store update. `FileTable`'s selection effect
  // depends on `onSelectionChange` by reference, so `handleSelectionChange` (and the
  // per-panel wrappers below) must stay referentially stable across renders -- otherwise
  // each call re-triggers that effect, which calls back in here, which updates the store
  // again, forever. A ref holds the latest `panels` for the stable callback to read.
  const panelsRef = useRef(panels);
  useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);

  const handleSelectionChange = useCallback(
    (index: PanelIndex, selection: FileEntry[]) => {
      setPanelSelection(index, selection);

      const siblingIndex = otherPanel(index);
      const sibling = panelsRef.current[siblingIndex];
      if (sibling.mode !== 'preview') return;

      const target = computePreviewTarget(selection);
      if (!sibling.isDirty) {
        setPanelPreviewFile(siblingIndex, target.previewFile);
        return;
      }
      if (target.previewFile !== sibling.previewFile) {
        setPendingLeave({
          panelIndex: siblingIndex,
          action: { type: 'switch-file', path: target.previewFile }
        });
      }
    },
    [setPanelSelection, setPanelPreviewFile]
  );

  const handlePanel0SelectionChange = useCallback(
    (selection: FileEntry[]) => handleSelectionChange(0, selection),
    [handleSelectionChange]
  );
  const handlePanel1SelectionChange = useCallback(
    (selection: FileEntry[]) => handleSelectionChange(1, selection),
    [handleSelectionChange]
  );

  useEffect(() => {
    window.fileExplorer.getHomeDir().then((home) => {
      if (panels[0].path === null) setPanelPath(0, home);
      if (panels[1].path === null) setPanelPath(1, home);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleModeToggle(index: PanelIndex, mode: PanelMode) {
    const panel = panels[index];
    if (panel.mode === 'preview' && panel.isDirty && mode === 'explorer') {
      setPendingLeave({ panelIndex: index, action: { type: 'switch-mode' } });
      return;
    }

    setPanelMode(index, mode);
    if (mode === 'preview') {
      const target = computePreviewTarget(panels[otherPanel(index)].selection);
      setPanelPreviewFile(index, target.previewFile);
      // Panel 2 has no independent location while previewing, so switching into
      // preview mode always snaps sidebar-driven navigation back to Panel 1.
      setActivePanel('panel1');
    }
  }

  function applyLeaveAction(panelIndex: PanelIndex, action: PendingLeaveAction) {
    if (action.type === 'switch-mode') {
      setPanelMode(panelIndex, 'explorer');
    } else {
      setPanelPreviewFile(panelIndex, action.path);
    }
  }

  function handleDiscard() {
    if (!pendingLeave) return;
    setPanelDirty(pendingLeave.panelIndex, false);
    applyLeaveAction(pendingLeave.panelIndex, pendingLeave.action);
    setPendingLeave(null);
    setDialogError(null);
  }

  async function handleSaveAndLeave() {
    if (!pendingLeave) return;
    setIsSavingPending(true);
    setDialogError(null);
    const success = await editorRefs[pendingLeave.panelIndex].current?.save();
    setIsSavingPending(false);
    if (!success) {
      setDialogError("Couldn't save changes. Try again or discard them.");
      return;
    }
    setPanelDirty(pendingLeave.panelIndex, false);
    applyLeaveAction(pendingLeave.panelIndex, pendingLeave.action);
    setPendingLeave(null);
  }

  function handleCancelLeave() {
    setPendingLeave(null);
    setDialogError(null);
  }

  const pendingFileName = pendingLeave
    ? (panels[pendingLeave.panelIndex].previewFile?.split(/[\\/]/).pop() ?? 'This file')
    : '';

  return (
    <div className="flex-1 flex min-h-0 min-w-0 bg-surface">
      <ResizablePanel
        edge="right"
        size={sidebarWidth}
        onResize={setSidebarWidth}
        min={150}
        max={400}
        className="bg-surface-2 border-r border-border flex flex-col h-full overflow-y-auto"
      >
        <FileExplorerSidebar />
      </ResizablePanel>

      <div className="flex-1 flex min-h-0 min-w-0">
        <ResizablePanel
          edge="right"
          size={panel1Width}
          onResize={setPanel1Width}
          min={20}
          unit="%"
          className="border-r border-border-dark flex flex-col h-full"
        >
          <FileExplorerPanelBody
            path={panels[0].path}
            onNavigate={(path) => setPanelPath(0, path)}
            onSelectionChange={handlePanel0SelectionChange}
            onActivate={() => setActivePanel('panel1')}
          />
        </ResizablePanel>

        <div className="flex-1 flex flex-col min-h-0 min-w-[200px]">
          {panels[1].mode === 'explorer' && (
            <FileExplorerPanelBody
              path={panels[1].path}
              onNavigate={(path) => setPanelPath(1, path)}
              onSelectionChange={handlePanel1SelectionChange}
              onActivate={() => setActivePanel('panel2')}
              modeSwitch={{ value: panels[1].mode, onChange: (mode) => handleModeToggle(1, mode) }}
            />
          )}
          {panels[1].mode === 'preview' && (
            <div
              className="flex-1 flex flex-col min-h-0 min-w-0"
              onMouseDownCapture={() => setActivePanel('panel2')}
            >
              <Breadcrumb
                currentPath={panels[1].path ?? ''}
                onNavigate={(path) => setPanelPath(1, path)}
                modeSwitch={{
                  value: panels[1].mode,
                  onChange: (mode) => handleModeToggle(1, mode)
                }}
                showPath={false}
              />
              <FilePreview
                ref={editorRef1}
                previewFile={panels[1].previewFile}
                unavailableReason={computePreviewTarget(panels[0].selection).unavailableReason}
                onDirtyChange={(dirty) => setPanelDirty(1, dirty)}
              />
            </div>
          )}
          {panels[1].mode === 'agent' && (
            <div
              className="flex-1 flex flex-col min-h-0 min-w-0"
              onMouseDownCapture={() => setActivePanel('panel2')}
            >
              <Breadcrumb
                currentPath={panels[1].path ?? ''}
                onNavigate={(path) => setPanelPath(1, path)}
                modeSwitch={{
                  value: panels[1].mode,
                  onChange: (mode) => handleModeToggle(1, mode)
                }}
                showPath={false}
              />
              <AgentPanel workingDirectory={panels[0].path} />
            </div>
          )}
        </div>
      </div>

      <Dialog.Root
        open={pendingLeave !== null}
        onOpenChange={(open) => !open && handleCancelLeave()}
      >
        <Dialog.Content className="max-w-sm" showClose={false}>
          <Dialog.Title>Unsaved changes</Dialog.Title>
          <Dialog.Description>
            {pendingFileName} has unsaved changes. Save them before leaving?
          </Dialog.Description>
          {dialogError && <p className="mt-2 text-xs text-red-500">{dialogError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleCancelLeave}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSaveAndLeave()}
              disabled={isSavingPending}
            >
              {isSavingPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}

export default FileExplorerMain;
