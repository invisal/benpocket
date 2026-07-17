import { forwardRef, type ReactNode, useEffect, useImperativeHandle, useState } from 'react';
import { AlertCircle, FileText, Loader2, Save } from 'lucide-react';
import { formatBytes } from './columns';
import cn from 'cnfast';

type PreviewKind = 'text' | 'image' | 'video';

const PREVIEWABLE_EXTENSIONS: Record<string, PreviewKind> = {
  txt: 'text',
  md: 'text',
  json: 'text',
  ini: 'text',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  ico: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  mkv: 'video',
  avi: 'video'
};

export type PreviewUnavailableReason = 'no-selection' | 'multiple-selection' | 'directory';

export interface PreviewEditorHandle {
  /** Writes the current buffer to disk. Resolves false (and leaves the buffer untouched) on failure. */
  save: () => Promise<boolean>;
}

interface FilePreviewProps {
  /** Path of the file currently loaded into the preview/edit buffer, or null if nothing valid is targeted. */
  previewFile: string | null;
  /** Why `previewFile` is null -- only read when `previewFile` is null. */
  unavailableReason: PreviewUnavailableReason;
  onDirtyChange: (dirty: boolean) => void;
}

function getExtension(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const dotIndex = base.lastIndexOf('.');
  return dotIndex > 0 ? base.slice(dotIndex + 1).toLowerCase() : '';
}

function PreviewMessage({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        'flex-1 flex flex-col items-center justify-center gap-2 text-text-dim text-xs px-4 text-center bg-dotted'
      }
    >
      <FileText size={20} className="text-zinc-600" />
      <span>{children}</span>
    </div>
  );
}

export const FilePreview = forwardRef<PreviewEditorHandle, FilePreviewProps>(function FilePreview(
  { previewFile, unavailableReason, onDirtyChange },
  ref
) {
  if (!previewFile) {
    if (unavailableReason === 'multiple-selection') {
      return <PreviewMessage>Select a single file to preview it.</PreviewMessage>;
    }
    if (unavailableReason === 'directory') {
      return <PreviewMessage>Folders can&apos;t be previewed.</PreviewMessage>;
    }
    return <PreviewMessage>Select a file in the left panel to preview it.</PreviewMessage>;
  }

  const extension = getExtension(previewFile);
  const kind = PREVIEWABLE_EXTENSIONS[extension];

  if (!kind) {
    return (
      <PreviewMessage>
        {extension
          ? `Preview not available for .${extension} files.`
          : 'Preview not available for this file.'}
      </PreviewMessage>
    );
  }

  if (kind === 'image' || kind === 'video') {
    return <MediaFileViewer key={previewFile} ref={ref} filePath={previewFile} kind={kind} />;
  }

  return (
    <TextFileEditor
      key={previewFile}
      ref={ref}
      filePath={previewFile}
      onDirtyChange={onDirtyChange}
    />
  );
});

const MediaFileViewer = forwardRef<
  PreviewEditorHandle,
  { filePath: string; kind: 'image' | 'video' }
>(function MediaFileViewer({ filePath, kind }, ref) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; objectUrl: string }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' });

    window.fileExplorer.readFileBinary(filePath).then((res) => {
      if (cancelled) return;
      if ('data' in res) {
        objectUrl = URL.createObjectURL(
          new Blob([new Uint8Array(res.data)], { type: res.mimeType })
        );
        setState({ status: 'ready', objectUrl });
      } else if ('maxBytes' in res) {
        setState({
          status: 'error',
          message: `This file is too large to preview (${formatBytes(res.maxBytes)} limit).`
        });
      } else if (res.error === 'unsupported-extension') {
        setState({ status: 'error', message: 'Preview not available for this file.' });
      } else {
        setState({ status: 'error', message: `Couldn't read this file: ${res.error}` });
      }
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filePath]);

  // Media previews are read-only -- nothing to write back.
  useImperativeHandle(ref, () => ({ save: () => Promise.resolve(true) }));

  if (state.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-dim text-xs px-4 text-center">
        <AlertCircle size={20} className="text-red-500" />
        <span>{state.message}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center overflow-auto bg-dotted p-3">
      {kind === 'image' ? (
        <img src={state.objectUrl} alt="" className="max-w-full max-h-full object-contain" />
      ) : (
        <video src={state.objectUrl} controls className="max-w-full max-h-full" />
      )}
    </div>
  );
});

const TextFileEditor = forwardRef<
  PreviewEditorHandle,
  { filePath: string; onDirtyChange: (dirty: boolean) => void }
>(function TextFileEditor({ filePath, onDirtyChange }, ref) {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
