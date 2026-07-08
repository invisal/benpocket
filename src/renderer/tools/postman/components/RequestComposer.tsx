import React from 'react';
import { Select } from '@base-ui/react/select';
import { Check, ChevronDown, RefreshCw, Send } from 'lucide-react';
import type { HttpMethod } from '../../../../preload/postman/types';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { VariableSuggestInput } from './VariableSuggestInput';

const METHODS: { value: HttpMethod; className: string }[] = [
  { value: 'GET', className: 'text-emerald-400' },
  { value: 'POST', className: 'text-amber-500' },
  { value: 'PUT', className: 'text-sky-500' },
  { value: 'PATCH', className: 'text-purple-400' },
  { value: 'DELETE', className: 'text-red-500' },
  { value: 'HEAD', className: 'text-zinc-400' },
  { value: 'OPTIONS', className: 'text-zinc-400' }
];

function colorFor(method: string): string {
  return METHODS.find((m) => m.value === method)?.className ?? 'text-zinc-300';
}

interface RequestComposerProps {
  method: HttpMethod;
  onMethodChange: (method: HttpMethod) => void;
  url: string;
  onUrlChange: (url: string) => void;
  isLoading: boolean;
  onSend: () => void;
}

export const RequestComposer: React.FC<RequestComposerProps> = ({
  method,
  onMethodChange,
  url,
  onUrlChange,
  isLoading,
  onSend
}) => {
  const variables = useActiveEnvironmentVariables();

  return (
    <div className="flex gap-2 shrink-0">
      <Select.Root value={method} onValueChange={(value) => onMethodChange(value as HttpMethod)}>
        <Select.Trigger
          className={`flex items-center gap-1.5 bg-sidebar-bg border border-border-dark text-xs rounded px-3 py-1.5 focus:outline-none focus:border-accent font-extrabold cursor-pointer min-w-23 justify-between ${colorFor(method)}`}
        >
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={12} className="text-zinc-500" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={4} className="z-50">
            <Select.Popup className="bg-sidebar-bg border border-border-dark rounded-md shadow-xl py-1 text-xs min-w-27.5 outline-none">
              {METHODS.map((m) => (
                <Select.Item
                  key={m.value}
                  value={m.value}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer font-bold data-highlighted:bg-border-dark/60 outline-none ${m.className}`}
                >
                  <Select.ItemText>{m.value}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={12} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>

      <div className="flex-1">
        <VariableSuggestInput
          value={url}
          onChange={onUrlChange}
          variables={variables}
          onEnter={onSend}
          placeholder="Enter request URL, e.g. https://api.example.com/v1/resource"
          className="w-full bg-sidebar-bg border border-border-dark text-xs rounded px-3 py-1.5 focus:outline-none focus:border-accent text-zinc-200"
        />
      </div>
      <button
        onClick={onSend}
        className="px-4 py-1.5 bg-accent/80 hover:bg-accent text-[#fff] text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
        <span>Send</span>
      </button>
    </div>
  );
};
