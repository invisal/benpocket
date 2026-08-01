import { useMemo } from 'react';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import type { CursorPathPoint } from '@shared/cursor-path';
import { computeAutoZoomFocalPath } from '@shared/zoom-resolve';

export function useAutoZoomFocalPaths(
  rawCursorPath: CursorPathPoint[],
  zoomKeyframes: ZoomKeyframe[]
): Map<string, CursorPathPoint[]> {
  return useMemo(
    () =>
      new Map(
        zoomKeyframes
          .filter((kf) => kf.position === 'auto-cursor')
          .map((kf) => [kf.id, computeAutoZoomFocalPath(rawCursorPath, kf)])
      ),
    [rawCursorPath, zoomKeyframes]
  );
}
