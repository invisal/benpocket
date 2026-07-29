import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ProjectVideoThumbnailProps {
  /** Absolute path to the project's source recording -- read fresh off disk since there's no live blob for a project that isn't the open editor session. */
  sourceVideoPath: string;
  className?: string;
}

/**
 * A saved project's card preview: reads the source video's bytes into a blob
 * URL (same construction as `apply-project-snapshot.ts`'s hydration path)
 * and renders it as a `<video preload="metadata">`, which the browser shows
 * as a static first-frame thumbnail without ever playing. Falls back to a
 * placeholder icon while the read is in flight or if it fails.
 */
export function ProjectVideoThumbnail({
  sourceVideoPath,
  className
}: ProjectVideoThumbnailProps): JSX.Element {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    void window.screenRecorder.export
      .readFileBytes(sourceVideoPath)
      .then((bytes) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
        setBlobUrl(url);
      })
      .catch((err) => {
        console.error('[project-thumbnail] failed to read source video:', err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sourceVideoPath]);

  if (!blobUrl || failed) {
    return (
      <span
        className={cn(
          'flex aspect-video w-full items-center justify-center rounded-md bg-surface-3',
          className
        )}
      >
        <Film size={18} className="text-muted-foreground" />
      </span>
    );
  }

  return (
    <video
      src={blobUrl}
      preload="metadata"
      muted
      className={cn('aspect-video w-full rounded-md bg-black object-cover', className)}
      onError={(e) => {
        console.error('[project-thumbnail] failed to load:', e.currentTarget.error);
        setFailed(true);
      }}
    />
  );
}
