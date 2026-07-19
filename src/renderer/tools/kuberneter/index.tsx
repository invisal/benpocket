import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { KuberneterSidebar } from './components/sidebar/KuberneterSidebar';
import { Workspace } from '@renderer/components/layout/Workspace';
import { useLayoutStore } from '../../src/store/layout.store';
import type React from 'react';
import { useState, useEffect, useRef } from 'react';

import { useKuberneterStore } from './store/kuberneter.store';
import { KuberneterHomeView } from './components/workspace/kubernetes-home';

export function KuberneterMain({ payload }: ToolComponentProps<{ instanceId: string }>) {
  const { instanceId } = payload;
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const setActiveInstanceId = useLayoutStore((s) => s.setActiveInstanceId);
  const kuberneterInstanceCluster = useKuberneterStore((s) => s.kuberneterInstanceCluster);
  const currentCluster = kuberneterInstanceCluster[instanceId] || '';

  useEffect(() => {
    if (instanceId) {
      setActiveInstanceId(instanceId);
    }
  }, [instanceId, setActiveInstanceId]);

  if (!currentCluster) {
    return <KuberneterHomeView />;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let finalWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      finalWidth = Math.max(150, Math.min(newWidth, 400));
      if (sidebarRef.current) {
        sidebarRef.current.style.width = `${finalWidth}px`;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setSidebarWidth(finalWidth);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex-1 flex min-h-0 min-w-0 bg-surface">
      {/* Tool-specific Collapsible Left Panel */}
      {isSidebarOpen && (
        <div
          ref={sidebarRef}
          style={{ width: `${sidebarWidth}px` }}
          className="relative bg-surface-2 border-r border-border-dark flex flex-col h-full shrink-0 p-3"
        >
          <KuberneterSidebar />
          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 w-[3px] h-full cursor-col-resize hover:bg-accent/30 active:bg-accent transition-colors z-40"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <Workspace />
      </div>
    </div>
  );
}
export default KuberneterMain;
