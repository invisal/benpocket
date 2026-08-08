import { useEffect, useState } from 'react';
import { decodeToImageData } from '../lib/codec';
import type { ImageToolId } from '../types';

type DecodeState =
  | { status: 'loading' }
  | { status: 'ready'; imageData: ImageData }
  | { status: 'error'; message: string };

/**
 * Owns exactly one piece of state for `ImageTool`: the current compressed binary. Everything else
 * -- the decoded `ImageData` used for display and by every tool's own math -- is derived from it
 * via a single effect, at most one re-decode per edit. Every tool commits by handing back new
 * compressed bytes (Resize/Crop get these directly from sharp; Context-aware Resize/Removal encode
 * their inpainted raw result locally first -- see `lib/codec.ts`'s `encodeImageData`), so `commit`
 * itself is just "replace the binary, tell the parent." One source of truth, easy to reason about.
 */
export function useImageEditor(
  initialBinary: Uint8Array<ArrayBuffer>,
  mimeType: string,
  onChange: (binary: Uint8Array<ArrayBuffer>) => void
): {
  binary: Uint8Array<ArrayBuffer>;
  decode: DecodeState;
  activeTool: ImageToolId;
  setActiveTool: (tool: ImageToolId) => void;
  commit: (newBinary: Uint8Array<ArrayBuffer>) => void;
} {
  // `useState(initialBinary)` only ever reads its argument on the very first render -- later
  // renders passing a different `initialBinary` (e.g. the parent's own state updating in lockstep
  // with our `onChange` calls) are ignored, so this never fights with `commit` below or re-seeds
  // itself mid-session.
  const [binary, setBinary] = useState(initialBinary);
  const [decode, setDecode] = useState<DecodeState>({ status: 'loading' });
  const [activeTool, setActiveTool] = useState<ImageToolId>('resize');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDecode({ status: 'loading' });

    decodeToImageData(binary, mimeType).then(
      (imageData) => {
        if (!cancelled) setDecode({ status: 'ready', imageData });
      },
      (err: unknown) => {
        if (!cancelled) {
          setDecode({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not decode this image.'
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [binary, mimeType]);

  function commit(newBinary: Uint8Array<ArrayBuffer>): void {
    setBinary(newBinary);
    onChange(newBinary);
  }

  return { binary, decode, activeTool, setActiveTool, commit };
}
