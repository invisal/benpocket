import { Select } from '@renderer/components/ui/Select';
import { Section, Swatch } from './Section';

const FRUITS = ['Apple', 'Banana', 'Cherry', 'Durian'];

export function SelectGallery() {
  return (
    <Section title="Select" description="Dropdown select built on @base-ui/react.">
      <Swatch label="default">
        <Select.Root defaultValue="Apple">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {FRUITS.map((fruit) => (
              <Select.Item key={fruit} value={fruit}>
                {fruit}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Swatch>

      <Swatch label="disabled">
        <Select.Root defaultValue="Apple" disabled>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {FRUITS.map((fruit) => (
              <Select.Item key={fruit} value={fruit}>
                {fruit}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Swatch>
    </Section>
  );
}
