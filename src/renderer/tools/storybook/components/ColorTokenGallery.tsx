import { cn } from 'cnfast';
import { Section } from './Section';

const SURFACE_TOKENS = [
  'bg-surface',
  'bg-surface-2',
  'bg-surface-3',
  'bg-surface-4',
  'bg-surface-5'
];
const TEXT_TOKENS = ['text-foreground', 'text-muted-foreground'];
const BORDER_TOKENS = ['border-border', 'border-border-dark'];
const STATE_TOKENS = ['bg-accent', 'bg-danger'];

function Chip({ token, className }: { token: string; className: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className={cn('size-14 rounded-md border border-border', className)} />
      <span className="text-[11px] text-muted-foreground">{token}</span>
    </div>
  );
}

export function ColorTokenGallery() {
  return (
    <>
      <Section
        title="Surface elevation"
        description="Lowest to highest layer; a higher step is the hover/selected state of the layer below."
      >
        {SURFACE_TOKENS.map((token) => (
          <Chip key={token} token={token} className={token} />
        ))}
      </Section>

      <Section title="Text">
        {TEXT_TOKENS.map((token) => (
          <div key={token} className="flex flex-col items-start gap-1.5">
            <div
              className={cn('rounded-md border border-border bg-surface px-3 py-3 text-sm', token)}
            >
              The quick brown fox
            </div>
            <span className="text-[11px] text-muted-foreground">{token}</span>
          </div>
        ))}
      </Section>

      <Section title="Borders">
        {BORDER_TOKENS.map((token) => (
          <div key={token} className="flex flex-col items-start gap-1.5">
            <div className={cn('size-14 rounded-md border-2 bg-surface', token)} />
            <span className="text-[11px] text-muted-foreground">{token}</span>
          </div>
        ))}
      </Section>

      <Section title="Accent / Danger">
        {STATE_TOKENS.map((token) => (
          <Chip key={token} token={token} className={token} />
        ))}
      </Section>
    </>
  );
}
