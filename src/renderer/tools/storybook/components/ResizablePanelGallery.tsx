import { useState } from 'react';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import { Section } from './Section';

export function ResizablePanelGallery() {
  const [width, setWidth] = useState(180);

  return (
    <Section title="Resizable Panel" description="Drag the right edge to resize.">
      <div className="flex h-40 w-full overflow-hidden rounded-md border border-border">
        <ResizablePanel
          edge="right"
          size={width}
          onResize={setWidth}
          min={120}
          max={320}
          className="bg-surface-2"
        >
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {Math.round(width)}px
          </div>
        </ResizablePanel>
        <div className="flex flex-1 items-center justify-center bg-surface text-xs text-muted-foreground">
          Content
        </div>
      </div>
    </Section>
  );
}
