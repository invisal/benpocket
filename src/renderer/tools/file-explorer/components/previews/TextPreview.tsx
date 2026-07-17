import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import cn from 'cnfast';
import { formatBytes } from '../columns';
import { PreviewMessage } from './PreviewMessage';
import { type PreviewEditorHandle } from './types';

export const TextPreview = forwardRef<
  PreviewEditorHandle,
  { filePath: string; onDirtyChange: (dirty: boolean) => void }
>(function TextPreview({ filePath, onDirtyChange }, ref) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; original: string; content: string }
    | { status: 'error'; message: string }
    | { status: 'unsupported'; message: string }
  >({ status: 'loading' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setState({ status: 'loading' });
    setSaveError(null);

    window.fileExplorer.readFileContent(filePath).then((res) => {
      if (cancelled) return;
      if ('content' in res) {
        setState({ status: 'ready', original: res.content, content: res.content });
      } else if ('maxBytes' in res) {
        setState({
          status: 'error',
          message: `This file is too large to preview (${formatBytes(res.maxBytes)} limit).`
        });
      } else if (res.error === 'unsupported-extension') {
        setState({ status: 'unsupported', message: 'Preview not available for this file.' });
      } else {
        setState({ status: 'error', message: `Couldn't read this file: ${res.error}` });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const isDirty = state.status === 'ready' && state.content !== state.original;

  useEffect(() => {
    onDirtyChange(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  async function handleSave(): Promise<boolean> {
    if (state.status !== 'ready') return false;
    const contentToSave = state.content;
    setIsSaving(true);
    setSaveError(null);
    const res = await window.fileExplorer.writeFileContent(filePath, contentToSave);
    setIsSaving(false);
    if ('success' in res) {
      setState((s) => (s.status === 'ready' ? { ...s, original: contentToSave } : s));
      return true;
    }
    setSaveError(`Couldn't save this file: ${res.error}`);
    return false;
  }

  useImperativeHandle(ref, () => ({ save: handleSave }));

  if (state.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (state.status === 'unsupported') {
    return <PreviewMessage>{state.message}</PreviewMessage>;
  }

  if (state.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-dim text-xs px-4 text-center">
        <AlertCircle size={20} className="text-red-500" />
        <span>{state.message}</span>
      </div>
    );
  }

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border-dark text-xs text-text-dim">
        <span className="truncate">{fileName}</span>
        <div className="flex items-center gap-2 shrink-0">
          {saveError && <span className="text-red-500">{saveError}</span>}
          {isDirty && !saveError && <span className="text-amber-500">Unsaved changes</span>}
          <button
            onClick={() => {
              void handleSave();
            }}
            disabled={!isDirty || isSaving}
            className={cn(
              'flex items-center gap-1 h-6 px-2 rounded text-xs cursor-pointer transition-colors',
              'border border-border',
              isDirty && !isSaving
                ? 'bg-surface-4 text-text-base hover:bg-surface-3'
                : 'text-text-dim opacity-50 cursor-not-allowed'
            )}
          >
            <Save size={12} />
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <textarea
        value={state.content}
        onChange={(e) => {
          const value = e.target.value;
          setState((s) => (s.status === 'ready' ? { ...s, content: value } : s));
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            void handleSave();
          }
        }}
        spellCheck={false}
        className="flex-1 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap text-zinc-200 bg-transparent outline-none resize-none"
      />
    </div>
  );
});
