import { useEffect, useState } from 'react';
import { formatBytes } from '../components/columns';

export type BinaryFilePreviewState =
  | { status: 'loading' }
  | { status: 'ready'; objectUrl: string }
  | { status: 'error'; message: string };

export function useBinaryFilePreview(filePath: string): BinaryFilePreviewState {
  const [state, setState] = useState<BinaryFilePreviewState>({ status: 'loading' });

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

  return state;
}
