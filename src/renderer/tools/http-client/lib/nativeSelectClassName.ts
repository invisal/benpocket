import { cn } from 'cnfast';

/** className for a plain native `<select>` matching the tool's input styling. */
export function nativeSelectClassName(py: 'py-1' | 'py-1.5' = 'py-1.5'): string {
  return cn(
    'bg-surface-2 border border-border rounded px-2',
    py,
    'text-zinc-200 focus:outline-none focus:border-accent cursor-pointer'
  );
}
