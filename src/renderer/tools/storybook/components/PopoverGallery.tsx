import { Popover } from '@renderer/components/ui/Popover';
import { Button } from '@renderer/components/ui/Button';
import { Section, Swatch } from './Section';

export function PopoverGallery() {
  return (
    <Section title="Popover" description="Anchored floating panel for lightweight forms or info.">
      <Swatch label="default">
        <Popover.Root>
          <Popover.Trigger render={<Button variant="outline">Share</Button>} />
          <Popover.Content>
            <Popover.Title className="text-[13px] font-medium text-foreground">
              Invite a teammate
            </Popover.Title>
            <Popover.Description className="mt-1 text-xs text-muted-foreground">
              They&apos;ll get access to every request in this workspace.
            </Popover.Description>
          </Popover.Content>
        </Popover.Root>
      </Swatch>
    </Section>
  );
}
