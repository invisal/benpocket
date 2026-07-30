import type React from 'react';
import { useRef } from 'react';
import { useLayoutStore } from '../../store/layout.store';
import { KuberneterBottomPanel } from '../../../tools/kuberneter/components/bottom-panel/KuberneterBottomPanel';

export const BottomPanel: React.FC = () => {
  const { isBottomPanelOpen, bottomPanelHeight, setBottomPanelHeight, activeActivity } =
    useLayoutStore();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;
    let finalHeight = bottomPanelHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const maxAllowedHeight = window.innerHeight - 32;
      finalHeight = Math.max(100, Math.min(startHeight - deltaY, maxAllowedHeight));
      if (panelRef.current) {
        panelRef.current.style.height = `${finalHeight}px`;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setBottomPanelHeight(finalHeight);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isBottomPanelOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{ height: `${bottomPanelHeight}px` }}
      className="relative bg-surface-2 border-t border-border-dark flex flex-col w-full select-none shrink-0 min-h-0 z-30"
    >
      {/* Top Vertical Resize Handle (matches sidebar handle size h-0.75 & accent hover colors) */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 right-0 h-0.75 cursor-row-resize hover:bg-accent/30 active:bg-accent transition-colors z-40"
      />

      {/* Render tool-specific bottom panel content */}
      {activeActivity === 'kuberneter' && <KuberneterBottomPanel />}

      {/* Fallback for other tools */}
      {activeActivity !== 'kuberneter' && (
        <div className="flex-1 flex items-center justify-center text-xs text-zinc-500 font-mono">
          Terminal & Bottom Panel (Active tool: {activeActivity || 'None'})
        </div>
      )}
    </div>
  );
};
