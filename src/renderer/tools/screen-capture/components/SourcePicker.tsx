import type { JSX } from 'react';
import { cn } from 'cnfast';
import type { CaptureSource } from '@screen-recorder/types/recording';
import type { SourceTab } from '../lib/use-capture-sources';

function SourceGrid({
  sources,
  selectedSource,
  onSelectSource,
  onCaptureSource,
  emptyMessage
}: {
  sources: CaptureSource[];
  selectedSource: CaptureSource | null;
  onSelectSource: (source: CaptureSource) => void;
  onCaptureSource?: (source: CaptureSource) => void;
  emptyMessage: string;
}): JSX.Element {
  if (sources.length === 0) {
    return <p className="text-sm text-text-dim">{emptyMessage}</p>;
  }

  return (
    <div className="grid w-full max-h-[min(18rem,40vh)] grid-cols-[repeat(auto-fill,10.5rem)] justify-start justify-items-start gap-2 overflow-y-auto">
      {sources.map((source) => {
        const selected = selectedSource?.id === source.id;
        return (
          <button
            key={source.id}
            type="button"
            onClick={() => onSelectSource(source)}
            onDoubleClick={() => onCaptureSource?.(source)}
            className={cn(
              'flex w-[10.5rem] flex-col rounded-lg border p-1.5 text-left transition-colors',
              selected
                ? 'border-accent bg-surface-raised'
                : 'border-border-dark bg-surface-raised hover:border-accent/60'
            )}
          >
            <img
              src={source.thumbnailDataUrl}
              alt={source.name}
              className="aspect-video w-full rounded-md object-cover"
            />
            <p className="mt-1.5 truncate text-[11px] font-medium">{source.name}</p>
          </button>
        );
      })}
    </div>
  );
}

interface SourcePickerPanelsProps {
  activeTab: SourceTab;
  screens: CaptureSource[];
  windows: CaptureSource[];
  selectedSource: CaptureSource | null;
  onSelectSource: (source: CaptureSource | null) => void;
  onCaptureSource?: (source: CaptureSource) => void;
}

export function SourcePickerPanels({
  activeTab,
  screens,
  windows,
  selectedSource,
  onSelectSource,
  onCaptureSource
}: SourcePickerPanelsProps): JSX.Element {
  const sources = activeTab === 'screen' ? screens : windows;
  const emptyMessage = activeTab === 'screen' ? 'No displays found.' : 'No windows found.';

  return (
    <SourceGrid
      sources={sources}
      selectedSource={selectedSource}
      onSelectSource={onSelectSource}
      onCaptureSource={onCaptureSource}
      emptyMessage={emptyMessage}
    />
  );
}
