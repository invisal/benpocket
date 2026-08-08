import type React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import type { HttpMethod } from '../../../../preload/http-client/types';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { VariableSuggestInput } from './VariableSuggestInput';
import { Menu } from '@renderer/components/ui/Menu';

/** The address bar's method selector doubles as the HTTP/WebSocket protocol switch. */
export type ComposerMethod = HttpMethod | 'WEBSOCKET';

const METHODS: { value: ComposerMethod; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
  { value: 'WEBSOCKET', label: 'WebSocket' }
];

interface ComposerAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

interface RequestComposerProps {
  method: ComposerMethod;
  onMethodChange: (method: ComposerMethod) => void;
  url: string;
  onUrlChange: (url: string) => void;
  urlDisabled?: boolean;
  action: ComposerAction;
}

export const RequestComposer: React.FC<RequestComposerProps> = ({
  method,
  onMethodChange,
  url,
  onUrlChange,
  urlDisabled,
  action
}) => {
  const variables = useActiveEnvironmentVariables();
  const selectedLabel = METHODS.find((m) => m.value === method)?.label ?? method;

  return (
    <div className="flex gap-2 shrink-0 px-3 py-0">
      <div className="flex border border-border h-9 rounded flex-1 bg-gray-50">
        <Menu.Root>
          <Menu.Trigger className="text-xs min-w-24 justify-between font-medium px-3 h-full flex items-center gap-1 border-r border-border cursor-pointer">
            <span>{selectedLabel}</span>
            <ChevronDownIcon size={14} />
          </Menu.Trigger>
          <Menu.Content align="start">
            {METHODS.map((m) => (
              <Menu.Item key={m.value} onClick={() => onMethodChange(m.value)}>
                {m.label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Root>

        <div className="flex-1 h-full">
          <VariableSuggestInput
            value={url}
            onChange={onUrlChange}
            variables={variables}
            disabled={urlDisabled}
            onEnter={() => {
              if (!action.disabled) action.onClick();
            }}
            className="w-full outline-none text-xs px-2 h-full py-0 disabled:opacity-60"
            placeholder="Enter request URL, e.g. https://api.example.com/v1/resource or {{base_url}}/..."
          />
        </div>

        <button
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.label}
          className={`px-3 text-xs flex gap-1 items-center justify-center font-medium disabled:opacity-50 ${action.className ?? 'text-blue-500'}`}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      </div>
    </div>
  );
};
