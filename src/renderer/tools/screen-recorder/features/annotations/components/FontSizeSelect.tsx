import type { JSX } from 'react';
import { Select } from '@renderer/components/ui/Select';
import { TEXT_FONT_SIZE_OPTIONS } from '../store/annotations-store';

interface FontSizeSelectProps {
  value: number;
  onChange: (fontSize: number) => void;
}

export function FontSizeSelect({ value, onChange }: FontSizeSelectProps): JSX.Element {
  return (
    <Select.Root value={String(value)} onValueChange={(v) => v && onChange(Number(v))}>
      <Select.Trigger size="sm" className="w-full justify-between">
        <Select.Value />
      </Select.Trigger>
      <Select.Content side="bottom" align="start">
        {TEXT_FONT_SIZE_OPTIONS.map((size) => (
          <Select.Item key={size} value={String(size)}>
            {size}px
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
