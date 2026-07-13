import type React from 'react';

interface ActionsPanelProps {
  onAddFile: () => void;
  onPasteClick: () => void;
}

export const ActionsPanel: React.FC<ActionsPanelProps> = ({ onAddFile, onPasteClick }) => {
  return (
    <div className="flex flex-col gap-3 shrink-0">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-sans">Start</h3>
      <div className="flex flex-col gap-1.5 pl-1.5">
        <button
          onClick={onAddFile}
          className="flex items-center gap-2 text-xs font-semibold text-accent hover:text-accent-light transition-colors cursor-pointer text-left py-1 w-fit group"
        >
          <span className="text-[14px] group-hover:scale-110 transition-transform font-bold">
            +
          </span>
          <span>Add Kubeconfig File...</span>
        </button>
        <button
          onClick={onPasteClick}
          className="flex items-center gap-2 text-xs font-semibold text-accent hover:text-accent-light transition-colors cursor-pointer text-left py-1 w-fit group"
        >
          <span className="text-[14px] group-hover:scale-110 transition-transform font-bold">
            +
          </span>
          <span>Paste Kubeconfig...</span>
        </button>
      </div>
    </div>
  );
};
