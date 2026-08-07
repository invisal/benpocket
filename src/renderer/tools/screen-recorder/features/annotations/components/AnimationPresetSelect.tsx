import type { JSX } from 'react';
import { Select } from '@renderer/components/ui/Select';
import { TEXT_ANIMATION_PRESETS } from '../presets/text-animation-presets';

interface AnimationPresetSelectProps {
  value: string;
  onChange: (id: string) => void;
}

export function AnimationPresetSelect({
  value,
  onChange
}: AnimationPresetSelectProps): JSX.Element {
  return (
    <Select.Root value={value} onValueChange={(v) => v && onChange(v)}>
      <Select.Trigger size="sm" className="w-full justify-between">
        <Select.Value className="capitalize" />
      </Select.Trigger>
      <Select.Content side="bottom" align="start">
        {TEXT_ANIMATION_PRESETS.map((preset) => (
          <Select.Item key={preset.id} value={preset.id}>
            {preset.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
