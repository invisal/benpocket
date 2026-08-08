import type React from 'react';
import { ChevronDown, ChevronDownIcon, RefreshCw, Send } from 'lucide-react';
import type { HttpMethod } from '../../../../preload/http-client/types';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { VariableSuggestInput } from './VariableSuggestInput';
import { Select } from '@renderer/components/ui/Select';
import { Select as SelectBase } from '@base-ui/react';
import { Button } from '@renderer/components/ui/Button';

const METHODS: { value: HttpMethod; className: string }[] = [
  { value: 'GET', className: 'text-emerald-400' },
  { value: 'POST', className: 'text-amber-500' },
  { value: 'PUT', className: 'text-sky-500' },
  { value: 'PATCH', className: 'text-purple-400' },
  { value: 'DELETE', className: 'text-red-500' },
  { value: 'HEAD', className: 'text-zinc-400' },
  { value: 'OPTIONS', className: 'text-zinc-400' }
];

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
    <div className="flex gap-2 shrink-0 px-3 py-0">
      <div className="flex border border-border h-9 rounded flex-1 bg-gray-50">
        <Select.Root value={method} onValueChange={(value) => onMethodChange(value as HttpMethod)}>
          <SelectBase.Trigger className="text-xs min-w-24 justify-between font-medium px-3 h-full flex items-center border-r border-border">
            <SelectBase.Value className="border-none" />
            <ChevronDownIcon size={14} />
          </SelectBase.Trigger>
          <Select.Content side="bottom" align="start">
            {METHODS.map((m) => (
              <Select.Item key={m.value} value={m.value}>
                <Select.ItemText>{m.value}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

        <div className="flex-1 h-full">
          <VariableSuggestInput
            value={url}
            onChange={onUrlChange}
            variables={variables}
            onEnter={onSend}
            className="w-full outline-none text-xs px-2 h-full py-0"
            placeholder="Enter request URL, e.g. https://api.example.com/v1/resource or {{base_url}}/..."
          />
        </div>

        <button className="px-3 text-xs flex gap-1 items-center justify-center text-blue-500 font-medium">
          <Send size={12} />
          <span>Send</span>
        </button>

        {/* <Button onClick={onSend} variant="primary" title="Send (Ctrl+Enter / ⌘Enter)">
            {isLoading ? <RefreshCw size={12} className="animate-spin" /> : }
            <span>Send</span>
          </Button> */}
      </div>
    </div>
  );
};
