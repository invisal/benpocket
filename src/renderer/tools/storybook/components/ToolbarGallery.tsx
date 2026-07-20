import { Toolbar } from '@renderer/components/ui/Toolbar';
import { Search, Filter, Plus } from 'lucide-react';
import { Section } from './Section';

export function ToolbarGallery() {
  return (
    <Section title="Toolbar" description="Horizontal action bar built on @base-ui/react.">
      <div className="w-full overflow-hidden rounded-md border border-border">
        <Toolbar.Root>
          <Toolbar.Group>
            <Toolbar.Button shape="square">
              <Search size={14} />
            </Toolbar.Button>
            <Toolbar.Input placeholder="Search..." className="w-40" />
          </Toolbar.Group>
          <Toolbar.Separator />
          <Toolbar.Button>
            <Filter size={14} />
            Filter
          </Toolbar.Button>
          <Toolbar.Link href="#">Docs</Toolbar.Link>
          <div className="flex-1" />
          <Toolbar.Button>
            <Plus size={14} />
            New
          </Toolbar.Button>
        </Toolbar.Root>
      </div>
    </Section>
  );
}
