import { type ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <div className="mb-10">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4 flex flex-wrap items-start gap-5 rounded-md border border-border bg-surface p-4">
        {children}
      </div>
    </div>
  );
}

export function Swatch({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
