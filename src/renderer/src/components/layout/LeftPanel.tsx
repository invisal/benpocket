import React from 'react';
import { useLayoutStore } from '../../store/layout.store';
import { LensSidebar } from './sidebars/LensSidebar';
import { HttpClientSidebar } from '../../../tools/http-client/HttpClientSidebar';
import { ScreenRecorderSidebar } from '../../../tools/screen-recorder/sidebar/ScreenRecorderSidebar';

export const LeftPanel: React.FC = () => {
  const { leftPanelWidth, setLeftPanelWidth, activeActivity, isLeftPanelOpen } = useLayoutStore();

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isLeftPanelOpen || !activeActivity) return null;

  return (
    <div
      style={{ width: `${leftPanelWidth}px` }}
      className="relative bg-surface-2 border-r border-border-dark flex flex-col h-full select-none shrink-0"
    >
      {/* Dynamic Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {activeActivity === 'lens' && <LensSidebar />}
        {activeActivity === 'postman' && <HttpClientSidebar />}
        {activeActivity === 'screenrecorder' && <ScreenRecorderSidebar />}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-[3px] h-full cursor-col-resize hover:bg-accent/30 active:bg-accent transition-colors z-40"
      />
    </div>
  );
};
