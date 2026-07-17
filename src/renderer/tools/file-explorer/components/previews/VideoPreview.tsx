import { forwardRef, useImperativeHandle } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useBinaryFilePreview } from '../../lib/useBinaryFilePreview';
import { type PreviewEditorHandle } from './types';

export const VideoPreview = forwardRef<PreviewEditorHandle, { filePath: string }>(
  function VideoPreview({ filePath }, ref) {
    const state = useBinaryFilePreview(filePath);

    // Video previews are read-only -- nothing to write back.
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
        <video src={state.objectUrl} controls className="max-w-full max-h-full" />
      </div>
    );
  }
);
