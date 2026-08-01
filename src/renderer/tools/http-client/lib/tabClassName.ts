import { cn } from 'cnfast';

/** className for a bordered underline tab that highlights when active. Shared by RequestEditorPanel and ResponseInspector's Tabs.Tab. */
export function tabClassName(active: boolean, py: 'py-1' | 'py-1.5' = 'py-1.5'): string {
  return cn(
    py,
    'border-b -mb-px cursor-pointer transition-colors',
    active
      ? 'border-accent text-accent font-semibold'
      : 'border-transparent text-zinc-555 hover:text-zinc-350'
  );
}
