import type { JSX } from 'react';
import { Select } from '@renderer/components/ui/Select';
import { EXPORT_PRESETS } from '../presets';
import { useExportStore } from '../store/export-store';

// TODO: presets are currently a fixed list (see ../presets.ts). Turn this
// into real CRUD once custom presets can be saved/renamed/deleted.
export function ExportPresetPicker(): JSX.Element {
  const presetId = useExportStore((state) => state.presetId);
  const setPreset = useExportStore((state) => state.setPreset);
  const selected = EXPORT_PRESETS.find((preset) => preset.id === presetId);

  return (
    <Select.Root value={presetId} onValueChange={(value) => setPreset(value as string)}>
      {/* base-ui's Select.Value renders the raw value (the preset id), so render the label ourselves. */}
      <Select.Trigger size="sm" className="w-44 justify-between">
        <span className="truncate">{selected?.label ?? 'Custom'}</span>
      </Select.Trigger>
      <Select.Content side="bottom" align="end">
        {EXPORT_PRESETS.map((preset) => (
          <Select.Item key={preset.id} value={preset.id}>
            {preset.label} — {preset.description}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
