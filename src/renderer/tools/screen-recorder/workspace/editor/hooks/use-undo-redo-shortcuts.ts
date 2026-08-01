import { useEffect } from 'react';

interface UseUndoRedoShortcutsOptions {
  undo: () => void;
  redo: () => void;
}

export function useUndoRedoShortcuts({ undo, redo }: UseUndoRedoShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      const isRedo = key === 'y' || (key === 'z' && event.shiftKey);
      const isUndo = key === 'z' && !event.shiftKey;
      if (!isUndo && !isRedo) return;

      const target = event.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isEditingText) return;

      event.preventDefault();
      if (isRedo) redo();
      else undo();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
}
