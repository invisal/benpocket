import { type ReactNode } from 'react';
import { FileText } from 'lucide-react';

export function PreviewMessage({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        'flex-1 flex flex-col items-center justify-center gap-2 text-text-dim text-xs px-4 text-center bg-dotted'
      }
    >
      <FileText size={20} className="text-zinc-600" />
      <span>{children}</span>
    </div>
  );
}
