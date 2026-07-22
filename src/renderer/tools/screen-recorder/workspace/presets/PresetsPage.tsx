import type { JSX } from 'react';
import { Check } from 'lucide-react';
import { EXPORT_PRESETS } from '../../features/export/presets';
import { useExportStore } from '../../features/export/store/export-store';
import { useAppStore } from '../../app/app-store';
import { cn } from '../../lib/utils';

// TODO: presets are currently a fixed list (see features/export/presets.ts).
// Turn this into real CRUD once custom presets can be saved/renamed/deleted.
export function PresetsPage(): JSX.Element {
  const presetId = useExportStore((state) => state.presetId);
  const setPreset = useExportStore((state) => state.setPreset);
  const setRoute = useAppStore((state) => state.setRoute);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">Presets</h1>
        <p className="text-sm text-muted-foreground">
          Pick a default for Export, or fine-tune settings there and it&apos;ll show up as Custom.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {EXPORT_PRESETS.map((preset) => {
          const isSelected = presetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => {
                setPreset(preset.id);
                setRoute('editor');
              }}
              className={cn(
                'relative rounded-xl border p-4 text-left transition-colors',
                isSelected ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/40'
              )}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-surface">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <p className="font-medium">{preset.label}</p>
              <p className="text-xs text-muted-foreground">{preset.description}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                {preset.format} · {preset.frameRate}fps
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
