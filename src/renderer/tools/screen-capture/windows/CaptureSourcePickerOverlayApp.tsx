import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { cn } from 'cnfast';
import { Button } from '@renderer/components/ui/Button';
import { useSyncDocumentTheme } from '@renderer/store/theme.store';
import type { CaptureSource } from '@screen-recorder/types/recording';
import type { CaptureSourcePickerOverlayInit } from '@shared/capture-source-picker-overlay';

function parseInit(): CaptureSourcePickerOverlayInit | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('options');
    return raw ? (JSON.parse(raw) as CaptureSourcePickerOverlayInit) : null;
  } catch {
    return null;
  }
}

/**
 * Single-display click-to-capture overlay from the capture toolbar's
 * Display/Window tabs. Confirming a pick requests a screenshot (delay is
 * stamped from the pill) and the overlay is closed by main before the grab
 * or countdown.
 */
export function CaptureSourcePickerOverlayApp(): JSX.Element | null {
  useSyncDocumentTheme();
  const init = useMemo(() => parseInit(), []);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasConfirmedRef = useRef(false);

  useEffect(() => {
    window.screenRecorder.recording
      .getCaptureSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  const matching = init
    ? sources.filter(
        (s) => s.type === init.type && (s.type !== 'screen' || s.displayId === init.targetDisplayId)
      )
    : [];
  const targetSource =
    matching.find((s) => s.id === selectedId) ?? (matching.length === 1 ? matching[0] : null);

  function confirmSelection(source: CaptureSource): void {
    if (!init) return;
    if (hasConfirmedRef.current) return;
    hasConfirmedRef.current = true;
    window.screenRecorder.captureToolbar.requestCapture({
      sourceId: source.id,
      delaySeconds: init.delaySeconds
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        window.screenRecorder.captureSourcePickerOverlay.cancel();
        return;
      }
      if (event.key === 'Enter' && targetSource) confirmSelection(targetSource);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSource]);

  if (!init) return null;

  return (
    <div
      className="relative h-screen w-screen"
      onClick={() => window.screenRecorder.captureSourcePickerOverlay.cancel()}
    >
      {init.type === 'screen' ? (
        matching.map(
          (source) =>
            source.displayBounds && (
              <button
                key={source.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(source.id);
                  confirmSelection(source);
                }}
                className={cn(
                  'group absolute flex items-center justify-center border-2 bg-black/35 transition-colors hover:border-accent hover:bg-black/60',
                  targetSource?.id === source.id
                    ? 'border-accent bg-black/60'
                    : 'border-transparent'
                )}
                style={{
                  left: source.displayBounds.x - init.origin.x,
                  top: source.displayBounds.y - init.origin.y,
                  width: source.displayBounds.width,
                  height: source.displayBounds.height
                }}
              />
            )
        )
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid max-h-[80vh] max-w-[80vw] grid-cols-4 gap-4 overflow-auto p-4">
            {matching.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => {
                  setSelectedId(source.id);
                  confirmSelection(source);
                }}
                title={source.name}
                className={cn(
                  'group relative overflow-hidden rounded-xl border bg-surface text-left',
                  targetSource?.id === source.id ? 'border-accent' : 'border-border'
                )}
              >
                <img
                  src={source.thumbnailDataUrl ?? ''}
                  alt={source.name}
                  className="aspect-video w-full object-cover opacity-80 transition-opacity group-hover:opacity-30"
                />
                <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">
                  {source.name}
                </p>
              </button>
            ))}
            {matching.length === 0 && (
              <p className="col-span-4 text-center text-muted-foreground">No windows available.</p>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center gap-6">
        {init.type === 'screen' && targetSource && (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="max-w-lg truncate text-2xl font-semibold text-white drop-shadow-sm">
                {targetSource.name}
              </h1>
              {targetSource.displayBounds && (
                <p className="text-white/60">
                  {Math.round(targetSource.displayBounds.width)}×
                  {Math.round(targetSource.displayBounds.height)}
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={(event) => {
                event.stopPropagation();
                if (targetSource) confirmSelection(targetSource);
              }}
              disabled={!targetSource}
              className="pointer-events-auto gap-2 rounded-full shadow-2xl"
            >
              Capture
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
