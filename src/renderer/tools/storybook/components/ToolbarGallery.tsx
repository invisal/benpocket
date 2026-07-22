import { Toolbar } from '@renderer/components/ui/Toolbar';
import { Filter, Plus } from 'lucide-react';
import { Section } from './Section';

export function ToolbarGallery() {
  return (
    <Section title="Toolbar" description="Horizontal action bar built on @base-ui/react.">
      <div className="w-full border border-border">
        <Toolbar.Root>
          <Toolbar.Input placeholder="Search..." className="w-40" />

          <Toolbar.Button>
            <Filter size={14} />
            Filter
          </Toolbar.Button>
          <Toolbar.FreeSpace />
          <Toolbar.Label>3 items</Toolbar.Label>
          <Toolbar.Button>
            <Plus size={14} />
            <span>New</span>
          </Toolbar.Button>
        </Toolbar.Root>
        <div className="h-48 bg-surface-2"></div>
      </div>
    </Section>
  );
}
