import type { JSX } from 'react';

/**
 * Plain gray hover-scrub marker -- swapped out for the cut-tool's pin
 * preview (CutMarker, rendered inside the clip row) while that tool is
 * armed, so the two don't visually double up (see CutTimeline.tsx, which
 * owns that condition). Positioned against `trackAreaRef` itself so it
 * spans the full track stack, same as the real Playhead.
 */
export function HoverScrubMarker({ leftPercent }: { leftPercent: number }): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-5 mx-0.5"
      style={{ left: `${leftPercent}%` }}
    >
      <div className="absolute inset-y-0 left-0 w-0.5 bg-muted-foreground/40" />
      <div className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full border border-border-dark bg-surface" />
    </div>
  );
}
