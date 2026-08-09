import type { ReactNode } from 'react';

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
      {children}
    </span>
  );
}
