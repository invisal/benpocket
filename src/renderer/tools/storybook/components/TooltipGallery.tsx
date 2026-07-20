import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Button } from '@renderer/components/ui/Button';
import { Section, Swatch } from './Section';

export function TooltipGallery() {
  return (
    <Section title="Tooltip" description="Hover hint, wraps a group of triggers in one Provider.">
      <Tooltip.Provider>
        <Swatch label="top">
          <Tooltip.Root>
            <Tooltip.Trigger render={<Button variant="outline">Hover me</Button>} />
            <Tooltip.Content side="top">Saved a moment ago</Tooltip.Content>
          </Tooltip.Root>
        </Swatch>

        <Swatch label="bottom">
          <Tooltip.Root>
            <Tooltip.Trigger render={<Button variant="outline">Hover me</Button>} />
            <Tooltip.Content side="bottom">Saved a moment ago</Tooltip.Content>
          </Tooltip.Root>
        </Swatch>
      </Tooltip.Provider>
    </Section>
  );
}
