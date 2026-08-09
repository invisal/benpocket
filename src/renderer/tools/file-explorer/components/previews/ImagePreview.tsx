import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import cn from 'cnfast';
import { Toolbar } from '@renderer/components/ui/Toolbar';
import {
  ImageTool,
  EDITABLE_MIME_TYPES,
  ToolSelectorMenu,
  type ImageToolId
} from '../../../image-editor';
import { formatBytes } from '../columns';
import { type PreviewEditorHandle } from './types';
import { Button } from '@renderer/components/ui/Button';

type ImagePreviewState =
  | { status: 'loading' }
  | {
      status: 'ready';
      /** Bytes as last saved (or first loaded, before any save). Used both for the dirty check
       * and to seed `ImageTool`'s `binary` prop -- `ImageTool` only reads that prop once, on
       * mount, so it's safe to pass a value that keeps changing on save without causing a
       * re-decode. */
      original: Uint8Array<ArrayBuffer>;
      current: Uint8Array<ArrayBuffer>;
      mimeType: string;
    }
  | { status: 'error'; message: string };

/** Read-only fallback for formats ImageTool can't safely re-encode (gif/bmp/ico/svg -- see
 * EDITABLE_MIME_TYPES). Manages its own objectURL lifecycle since, unlike ImageTool's canvas, an
 * <img> needs one. */
function ReadOnlyImage({ bytes, mimeType }: { bytes: Uint8Array<ArrayBuffer>; mimeType: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bytes, mimeType]);

  return (
    <div className="flex-1 flex items-center justify-center overflow-auto bg-dotted p-3">
      {url && <img src={url} alt="" className="max-w-full max-h-full object-contain" />}
    </div>
  );
}

export const ImagePreview = forwardRef<
  PreviewEditorHandle,
  { filePath: string; onDirtyChange: (dirty: boolean) => void }
>(function ImagePreview({ filePath, onDirtyChange }, ref) {
  const [state, setState] = useState<ImagePreviewState>({ status: 'loading' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tool, setTool] = useState<ImageToolId>('preview');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' });
    setSaveError(null);

    window.fileExplorer.readFileBinary(filePath).then((res) => {
      if (cancelled) return;
      if ('data' in res) {
        const bytes = new Uint8Array(res.data);
        setState({ status: 'ready', original: bytes, current: bytes, mimeType: res.mimeType });
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
    };
  }, [filePath]);

  // Every commit inside ImageTool produces a brand-new Uint8Array, so reference inequality is a
  // cheap and sufficient dirty check -- no need to diff bytes.
  const isDirty = state.status === 'ready' && state.current !== state.original;

  useEffect(() => {
    onDirtyChange(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  async function handleSave(): Promise<boolean> {
    if (state.status !== 'ready') return false;
    const bytesToSave = state.current;
    setIsSaving(true);
    setSaveError(null);
    const res = await window.fileExplorer.writeFileBinary(filePath, bytesToSave);
    setIsSaving(false);
    if ('success' in res) {
      setState((s) => (s.status === 'ready' ? { ...s, original: bytesToSave } : s));
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

  if (state.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-dim text-xs px-4 text-center">
        <AlertCircle size={20} className="text-red-500" />
        <span>{state.message}</span>
      </div>
    );
  }

  const isEditable = EDITABLE_MIME_TYPES.has(state.mimeType);

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault();
          void handleSave();
        }
      }}
    >
      <Toolbar.Root>
        {isEditable && <ToolSelectorMenu active={tool} onSelect={setTool} />}
        <div className="flex-1" />
        <div className="flex items-center justify-center pr-2">
          <Button
            variant={isDirty && !isSaving ? 'primary' : undefined}
            size="sm"
            onClick={() => {
              void handleSave();
            }}
            disabled={!isDirty || isSaving}
          >
            <Save size={12} />
            <span> {isSaving ? 'Saving…' : 'Save'}</span>
          </Button>
        </div>
      </Toolbar.Root>

      {isEditable ? (
        <ImageTool
          binary={state.original}
          mimeType={state.mimeType}
          onChange={(bytes) =>
            setState((s) => (s.status === 'ready' ? { ...s, current: bytes } : s))
          }
          tool={tool}
          onToolChange={setTool}
          className="flex-1 min-h-0"
        />
      ) : (
        <ReadOnlyImage bytes={state.current} mimeType={state.mimeType} />
      )}
    </div>
  );
});
