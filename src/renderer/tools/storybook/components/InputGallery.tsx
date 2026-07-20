import { Input } from '@renderer/components/ui/Input';
import { Section, Swatch } from './Section';

const SIZES = ['sm', 'md', 'lg'] as const;

export function InputGallery() {
  return (
    <>
      <Section title="Sizes">
        {SIZES.map((size) => (
          <Swatch key={size} label={size}>
            <Input size={size} placeholder="Type something..." className="w-56" />
          </Swatch>
        ))}
      </Section>

      <Section title="States">
        <Swatch label="default">
          <Input placeholder="Empty" className="w-56" />
        </Swatch>
        <Swatch label="with value">
          <Input defaultValue="Hello world" className="w-56" />
        </Swatch>
        <Swatch label="disabled">
          <Input disabled defaultValue="Can't touch this" className="w-56" />
        </Swatch>
      </Section>
    </>
  );
}
