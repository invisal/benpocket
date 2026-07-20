import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { Section, Swatch } from './Section';

export function ContextMenuGallery() {
  return (
    <Section title="Context Menu" description="Right-click the box below to open it.">
      <Swatch label="right-click me">
        <ContextMenu.Root>
          <ContextMenu.Trigger
            render={
              <div className="flex h-24 w-56 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                Right-click here
              </div>
            }
          />
          <ContextMenu.Content>
            <ContextMenu.Item shortcut="mod+c">Copy</ContextMenu.Item>
            <ContextMenu.Item shortcut="mod+v">Paste</ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.CheckboxItem defaultChecked>Show hidden files</ContextMenu.CheckboxItem>
            <ContextMenu.Separator />
            <ContextMenu.Item shortcut="delete">Delete</ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Root>
      </Swatch>
    </Section>
  );
}
