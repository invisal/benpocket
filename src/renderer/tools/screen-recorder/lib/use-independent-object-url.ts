import { useEffect, useState } from 'react';

/**
 * Mints a private `blob:` URL backed by the same bytes as `sourceUrl`,
 * rather than handing out the literal same URL string to every consumer.
 * Chromium's blob URL store will spuriously fail one of the readers with
 * `MediaError.MEDIA_ERR_NETWORK` -- no failed request in the Network panel,
 * nothing logged to console -- when the *same* blob: URL is read
 * concurrently by more than one consumer. The editor always has at least
 * PreviewStage's two `<video>` elements and CutTimeline's waveform fetch
 * racing the same recording's `previewUrl` on mount, which reproduced this
 * every time; ZoomFocalPreview and CropDialog add more concurrent readers
 * on top of that whenever they're open. Each call site using its own
 * derived copy instead of the shared original sidesteps the contention
 * entirely, at the cost of one extra `fetch` + in-memory copy per site.
 */
interface DerivedUrl {
  /** Which `sourceUrl` `url` was derived from -- lets the hook report `null`
   * for a stale result (still resolving, or belonging to a since-changed
   * `sourceUrl`) without a synchronous `setState` at the top of the effect. */
  sourceUrl: string | null | undefined;
  url: string | null;
}

export function useIndependentObjectUrl(sourceUrl: string | null | undefined): string | null {
  const [derived, setDerived] = useState<DerivedUrl>({ sourceUrl: undefined, url: null });

  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    let created: string | null = null;
    fetch(sourceUrl)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setDerived({ sourceUrl, url: created });
      })
      .catch((err) => {
        console.error('[use-independent-object-url] failed to derive a private blob URL:', err);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [sourceUrl]);

  return derived.sourceUrl === sourceUrl ? derived.url : null;
}
