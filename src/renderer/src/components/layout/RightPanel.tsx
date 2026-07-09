import React from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { useLayoutStore } from '../../store/layout.store';

export const RightPanel: React.FC = () => {
  const { rightPanelWidth, setRightPanelWidth, isRightPanelOpen, toggleRightPanel } =
    useLayoutStore();

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Invert sign because dragging left increases width of the right panel
      const newWidth = startWidth - (moveEvent.clientX - startX);
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isRightPanelOpen) return null;

  return (
    <div
      style={{ width: `${rightPanelWidth}px` }}
      className="relative bg-sidebar-bg border-l border-border-dark flex flex-col h-full select-none shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border-dark">
        <div className="flex items-center gap-1.5 text-accent">
          <Sparkles size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">Copilot Chat</span>
        </div>
        <button
          onClick={toggleRightPanel}
          className="p-1 hover:bg-editor-bg rounded text-zinc-555 hover:text-white cursor-pointer transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Chat History View Mock */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-xs">
        <div className="flex flex-col gap-1 max-w-[85%] self-start bg-editor-bg border border-border-dark p-2 rounded-r-lg rounded-tl-lg text-zinc-300">
          <span>Hello! How can I assist you with your project layout today?</span>
          <span className="text-[9px] text-zinc-500 text-right">10:04 PM</span>
        </div>

        <div className="flex flex-col gap-1 max-w-[85%] self-end bg-accent/10 border border-accent/25 p-2 rounded-l-lg rounded-tr-lg text-accent">
          <span>Make a premium VS Code clone!</span>
          <span className="text-[9px] text-accent/80 text-right">10:05 PM</span>
        </div>

        <div className="flex flex-col gap-1 max-w-[85%] self-start bg-editor-bg border border-border-dark p-2 rounded-r-lg rounded-tl-lg text-zinc-300">
          <span>
            Excellent request! I am helping you craft the layouts using Tailwind v4, React, and
            Electron right now. Let me know if you need to open local folder systems using Kuberneter.
          </span>
          <span className="text-[9px] text-zinc-500 text-right">10:05 PM</span>
        </div>
      </div>

      {/* Input box */}
      <div className="p-3 border-t border-border-dark flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask Copilot..."
          className="flex-1 bg-editor-bg border border-border-dark rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent placeholder-zinc-650"
        />
        <button className="p-1.5 bg-editor-bg hover:bg-accent rounded text-zinc-400 hover:text-[#fff] cursor-pointer transition-all">
          <Send size={12} />
        </button>
      </div>

      {/* Resize Handle (Left edge) */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 w-[3px] h-full cursor-col-resize hover:bg-accent/30 active:bg-accent transition-colors z-40"
      />
    </div>
  );
};
