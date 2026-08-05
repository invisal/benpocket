import { useState } from 'react';
import { Globe, Waves } from 'lucide-react';
import { PillTab, UnderlineTab } from '@renderer/components/ui/Tabs';
import { Section, Swatch } from './Section';

const PANES = ['Params', 'Headers', 'Body'];

export function TabGallery() {
  const [pillValue, setPillValue] = useState('http');
  const [underlineValue, setUnderlineValue] = useState(PANES[0]);

  return (
    <Section title="Tab" description="Tabbed navigation built on @base-ui/react.">
      <Swatch label="PillTab">
        <PillTab.Root value={pillValue} onValueChange={(value) => setPillValue(value as string)}>
          <PillTab.List>
            <PillTab.Item value="http">
              <Globe size={13} />
              HTTP
            </PillTab.Item>
            <PillTab.Item value="websocket">
              <Waves size={13} />
              WebSocket
            </PillTab.Item>
            <PillTab.Item value="disabled" disabled>
              Disabled
            </PillTab.Item>
          </PillTab.List>
        </PillTab.Root>
      </Swatch>

      <Swatch label="UnderlineTab">
        <UnderlineTab.Root
          value={underlineValue}
          onValueChange={(value) => setUnderlineValue(value as string)}
        >
          <UnderlineTab.List className="border-b border-border">
            {PANES.map((pane) => (
              <UnderlineTab.Item key={pane} value={pane}>
                {pane}
              </UnderlineTab.Item>
            ))}
            <UnderlineTab.Item value="Disabled" disabled>
              Disabled
            </UnderlineTab.Item>
            <UnderlineTab.Indicator />
          </UnderlineTab.List>
          {PANES.map((pane) => (
            <UnderlineTab.Panel
              key={pane}
              value={pane}
              className="pt-2 text-xs text-muted-foreground"
            >
              {pane} panel content.
            </UnderlineTab.Panel>
          ))}
        </UnderlineTab.Root>
      </Swatch>
    </Section>
  );
}
