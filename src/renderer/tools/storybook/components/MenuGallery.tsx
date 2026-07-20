import { Menu } from '@renderer/components/ui/Menu';
import { Button } from '@renderer/components/ui/Button';
import { ChevronDown } from 'lucide-react';
import { Section, Swatch } from './Section';

export function MenuGallery() {
  return (
    <Section
      title="Menu"
      description="Click-to-open dropdown, same visual language as ContextMenu."
    >
      <Swatch label="default">
        <Menu.Root>
          <Menu.Trigger
            render={
              <Button variant="outline">
                Actions
                <ChevronDown className="size-3.5" />
              </Button>
            }
          />
          <Menu.Content>
            <Menu.Group>
              <Menu.GroupLabel>Workspace</Menu.GroupLabel>
              <Menu.Item>Rename</Menu.Item>
              <Menu.Item>Duplicate</Menu.Item>
            </Menu.Group>
            <Menu.Separator />
            <Menu.Item>Delete</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Swatch>
    </Section>
  );
}
