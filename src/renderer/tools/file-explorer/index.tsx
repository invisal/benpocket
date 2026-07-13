import { useEffect, useState } from 'react';
import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { FileExplorerPanelBody } from './components/FileExplorerPanelBody';
import { FilePreview } from './components/FilePreview';
import { FileExplorerSidebar } from './components/FileExplorerSidebar';
import { Breadcrumb } from './components/Breadcrumb';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import {
  createFileExplorerStore,
  FileExplorerStoreContext,
  useFileExplorerStore
} from './store/fileExplorer.store';

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

function FileExplorerLayout() {
  const panel1Path = useFileExplorerStore((s) => s.panel1Path);
  const panel2Path = useFileExplorerStore((s) => s.panel2Path);
  const panel2Mode = useFileExplorerStore((s) => s.panel2Mode);
  const panel1Selection = useFileExplorerStore((s) => s.panel1Selection);
  const sidebarWidth = useFileExplorerStore((s) => s.sidebarWidth);
  const panel1Width = useFileExplorerStore((s) => s.panel1Width);
  const setPanel1Path = useFileExplorerStore((s) => s.setPanel1Path);
  const setPanel2Path = useFileExplorerStore((s) => s.setPanel2Path);
  const setPanel1Selection = useFileExplorerStore((s) => s.setPanel1Selection);
  const setActivePanel = useFileExplorerStore((s) => s.setActivePanel);
  const setSidebarWidth = useFileExplorerStore((s) => s.setSidebarWidth);
  const setPanel1Width = useFileExplorerStore((s) => s.setPanel1Width);
  const setPanel2Mode = useFileExplorerStore((s) => s.setPanel2Mode);

  useEffect(() => {
    window.fileExplorer.getHomeDir().then((home) => {
      if (panel1Path === null) setPanel1Path(home);
      if (panel2Path === null) setPanel2Path(home);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 flex min-h-0 min-w-0 bg-surface">
      <ResizablePanel
        edge="right"
        size={sidebarWidth}
        onResize={setSidebarWidth}
        min={150}
        max={400}
        className="bg-surface-2 border-r border-border-dark flex flex-col h-full p-3 overflow-y-auto"
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
            path={panel1Path}
            onNavigate={setPanel1Path}
            onSelectionChange={setPanel1Selection}
            onActivate={() => setActivePanel('panel1')}
          />
        </ResizablePanel>

        <div className="flex-1 flex flex-col min-h-0 min-w-[200px]">
          {panel2Mode === 'table' ? (
            <FileExplorerPanelBody
              path={panel2Path}
              onNavigate={setPanel2Path}
              onActivate={() => setActivePanel('panel2')}
              modeSwitch={{ value: panel2Mode, onChange: setPanel2Mode }}
            />
          ) : (
            <div
              className="flex-1 flex flex-col min-h-0 min-w-0"
              onMouseDownCapture={() => setActivePanel('panel2')}
            >
              <Breadcrumb
                currentPath={panel2Path ?? ''}
                onNavigate={setPanel2Path}
                modeSwitch={{ value: panel2Mode, onChange: setPanel2Mode }}
                showPath={false}
              />
              <FilePreview selection={panel1Selection} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileExplorerMain;
