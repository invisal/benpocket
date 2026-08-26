import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { cn } from 'cnfast';
import { useSyncDocumentTheme } from '@renderer/store/theme.store';
import type { CaptureSource } from '@screen-recorder/types/recording';
import type { CaptureSourcePickerOverlayOpenOptions } from '@shared/capture-source-picker-overlay';

function parseInit(): CaptureSourcePickerOverlayOpenOptions | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('options');
    return raw ? (JSON.parse(raw) as CaptureSourcePickerOverlayOpenOptions) : null;
  } catch {
    return null;
  }
}

/**
 * Thumbnail-grid click-to-capture overlay from the capture toolbar's
 * Display/Window tabs. Lists every matching source — all displays, not just
 * the cursor's monitor — so multi-monitor setups can pick any screen.
 * Confirming a pick requests a screenshot (delay is stamped from the pill)
 * and the overlay is closed by main before the grab or countdown.
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

  const matching = init ? sources.filter((s) => s.type === init.type) : [];
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
      <div
        className="flex h-full w-full items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid max-h-[80vh] w-[80vw] grid-cols-4 gap-4 overflow-auto p-4">
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
                src={source.thumbnailDataUrl}
                alt={source.name}
                className="aspect-video w-full object-cover opacity-80 transition-opacity group-hover:opacity-30"
              />
              <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">
                {source.name}
                {source.displayBounds && (
                  <span className="text-muted-foreground/60">
                    {' '}
                    · {Math.round(source.displayBounds.width)}×
                    {Math.round(source.displayBounds.height)}
                  </span>
                )}
              </p>
            </button>
          ))}
          {matching.length === 0 && (
            <p className="col-span-4 text-center text-muted-foreground">
              {init.type === 'screen' ? 'No displays available.' : 'No windows available.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
