import { Button } from '@renderer/components/ui/Button';
import { Section, Swatch } from './Section';

const VARIANTS = ['primary', 'secondary', 'destructive', 'outline', 'ghost'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

export function ButtonGallery() {
  return (
    <>
      <Section title="Variants" description="Button variant, at the default size.">
        {VARIANTS.map((variant) => (
          <Swatch key={variant} label={variant}>
            <Button variant={variant}>Button</Button>
          </Swatch>
        ))}
      </Section>

      <Section title="Sizes" description="Button size, using the primary variant.">
        {SIZES.map((size) => (
          <Swatch key={size} label={size}>
            <Button size={size}>Button</Button>
          </Swatch>
        ))}
      </Section>

      <Section title="Disabled">
        <Swatch label="primary, disabled">
          <Button disabled>Button</Button>
        </Swatch>
        <Swatch label="outline, disabled">
          <Button variant="outline" disabled>
            Button
          </Button>
        </Swatch>
      </Section>
    </>
  );
}
